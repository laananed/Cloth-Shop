from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json
import base64
import hashlib
import hmac
import time
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from pymysql.err import MySQLError
from fastapi.middleware.cors import CORSMiddleware
from app.db import test_connection, get_db

app = FastAPI(
    title="Frieren Cloth Shop API",
    description="服装商城 / 进销存管理系统后端 API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5900",
        "http://localhost:5900",
        "http://127.0.0.1:8050",
        "http://localhost:8050",
        "https://laananed.github.io",
        "https://laananed.github.io/Cloth-Shop",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
PRODUCT_UPLOAD_DIR = UPLOAD_DIR / "products"

PRODUCT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ADMIN_TOKEN_SECRET = b"frieren-cloth-shop-admin-token-v1"
ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60
PRODUCT_DESCRIPTION_MAX_LENGTH = 1000


def build_product_image_filename(original_filename: str) -> str:
    suffix = Path(original_filename or "").suffix.lower()

    if suffix not in ALLOWED_IMAGE_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail="图片格式不支持，请上传 jpg、jpeg、png、webp 或 gif 文件"
        )

    import uuid
    return f"{uuid.uuid4().hex}{suffix}"


def cleanup_saved_product_images(saved_image_urls: list[str]) -> None:
    for image_url in saved_image_urls:
        image_path = PRODUCT_UPLOAD_DIR / Path(image_url).name
        try:
            if image_path.exists():
                image_path.unlink()
        except OSError:
            pass


async def save_product_uploads(uploaded_images: list[UploadFile]) -> list[str]:
    saved_images = []
    max_size = 8 * 1024 * 1024

    try:
        for uploaded_image in uploaded_images:
            if not uploaded_image or not uploaded_image.filename:
                continue

            image_filename = build_product_image_filename(uploaded_image.filename)
            content = await uploaded_image.read()

            if not content:
                raise HTTPException(status_code=400, detail="上传的图片文件为空")

            if len(content) > max_size:
                raise HTTPException(status_code=400, detail="图片不能超过 8MB")

            image_path = PRODUCT_UPLOAD_DIR / image_filename
            image_path.write_bytes(content)
            saved_images.append(f"/uploads/products/{image_filename}")
    except Exception:
        cleanup_saved_product_images(saved_images)
        raise

    return saved_images

def query_product_images(conn, product_ids: list[int]) -> dict[int, list[dict]]:
    ids = sorted({int(product_id) for product_id in product_ids if product_id is not None})
    if not ids:
        return {}

    placeholders = ", ".join(["%s"] * len(ids))
    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT id, product_id, image_url, sort_order, is_main
            FROM product_image
            WHERE is_deleted = 0
              AND product_id IN ({placeholders})
            ORDER BY product_id, is_main DESC, sort_order ASC, id ASC
            """,
            ids
        )
        rows = cursor.fetchall()

    image_map = {product_id: [] for product_id in ids}
    for row in rows:
        image_map.setdefault(row["product_id"], []).append({
            "id": row["id"],
            "image_url": row["image_url"],
            "sort_order": row["sort_order"],
            "is_main": row["is_main"],
        })
    return image_map


def attach_product_images(conn, rows: list[dict]) -> list[dict]:
    image_map = query_product_images(conn, [row.get("product_id") for row in rows])
    for row in rows:
        product_id = row.get("product_id")
        images = image_map.get(product_id, [])
        if not images and row.get("image_url"):
            images = [{
                "id": None,
                "image_url": row["image_url"],
                "sort_order": 0,
                "is_main": 1,
                "source": "product.image_url",
            }]
        row["images"] = images
        row["image_count"] = len(images)
    return rows


def serialize_sku_rows(rows: list[dict]) -> list[dict]:
    """为前后台统一补充结构化 SKU 别名，同时保留数据库原字段。"""
    for row in rows:
        row["sku_code"] = row.get("sku_code")
        row["color"] = row.get("color_name")
        row["size"] = row.get("size_name")
        row["stock"] = int(row.get("available_stock") or 0)
        row["on_sale"] = 1 if row.get("sku_status") == "ON_SALE" else 0
        row["sku_is_deleted"] = int(row.get("sku_is_deleted") or 0)
    return rows


def create_admin_token(admin_user_id: int) -> str:
    expires_at = int(time.time()) + ADMIN_TOKEN_TTL_SECONDS
    payload = f"{admin_user_id}:{expires_at}"
    signature = hmac.new(ADMIN_TOKEN_SECRET, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    token_text = f"{payload}:{signature}"
    token_bytes = base64.urlsafe_b64encode(token_text.encode("utf-8"))
    return token_bytes.decode("utf-8").rstrip("=")


def verify_admin_token(token: str) -> int:
    token_text = str(token or "").strip()

    if not token_text:
        raise HTTPException(status_code=401, detail="管理员登录已失效，请重新登录")

    padding = "=" * (-len(token_text) % 4)

    try:
      decoded = base64.urlsafe_b64decode(f"{token_text}{padding}".encode("utf-8")).decode("utf-8")
    except Exception:
        raise HTTPException(status_code=401, detail="管理员登录已失效，请重新登录")

    parts = decoded.split(":")

    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="管理员登录已失效，请重新登录")

    admin_user_id_text, expires_at_text, signature = parts

    try:
        admin_user_id = int(admin_user_id_text)
        expires_at = int(expires_at_text)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="管理员登录已失效，请重新登录")

    if expires_at < int(time.time()):
        raise HTTPException(status_code=401, detail="管理员登录已失效，请重新登录")

    payload = f"{admin_user_id}:{expires_at}"
    expected_signature = hmac.new(ADMIN_TOKEN_SECRET, payload.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=401, detail="管理员登录已失效，请重新登录")

    return admin_user_id


def require_admin_user(authorization: str | None):
    if not authorization:
        raise HTTPException(status_code=401, detail="请先登录管理员账号")

    auth_value = str(authorization).strip()

    if not auth_value.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="请先登录管理员账号")

    admin_user_id = verify_admin_token(auth_value.split(" ", 1)[1].strip())

    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, email, is_admin, is_deleted
                    FROM `user`
                    WHERE id = %s
                    """,
                    (admin_user_id,)
                )
                admin_user = cursor.fetchone()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"校验管理员身份失败：{str(e)}"
        )

    if not admin_user:
        raise HTTPException(status_code=403, detail="不是管理员账号")

    if int(admin_user.get("is_deleted") or 0) != 0 or int(admin_user.get("is_admin") or 0) != 1:
        raise HTTPException(status_code=403, detail="不是管理员账号")

    return admin_user

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads"
)

class CartAddRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    sku_id: int = Field(..., gt=0, description="SKU ID")
    quantity: int = Field(..., gt=0, description="加入购物车数量")

class CartUpdateQuantityRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    cart_item_id: int = Field(..., gt=0, description="购物车明细ID")
    quantity: int = Field(..., gt=0, description="修改后的购物车商品数量")

class CartDeleteItemRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    cart_item_id: int = Field(..., gt=0, description="购物车明细ID")

class OrderFromCartRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    address_id: int = Field(..., gt=0, description="收货地址ID")

class OrderFromSelectedCartRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    address_id: int = Field(..., gt=0, description="收货地址ID")
    cart_item_ids: list[int] = Field(..., min_length=1, description="要结算的购物车明细ID列表")

class PayOrderRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    order_id: int = Field(..., gt=0, description="订单ID")
    pay_method: str = Field(..., description="支付方式：ALIPAY / WECHAT / COD")
    pay_password: str = Field(..., min_length=6, max_length=6, description="6位支付密码")

class AddressAddRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    recipient_name: str = Field(..., min_length=1, max_length=50, description="收货人")
    phone: str = Field(..., min_length=1, max_length=20, description="手机号")
    detail: str = Field(..., min_length=1, max_length=255, description="详细地址")
    is_default: bool = Field(False, description="是否设为默认地址")

class AddressSetDefaultRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    address_id: int = Field(..., gt=0, description="地址ID")


class AddressDeleteRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    address_id: int = Field(..., gt=0, description="地址ID")

class DirectOrderRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    address_id: int = Field(..., gt=0, description="收货地址ID")
    sku_id: int = Field(..., gt=0, description="SKU ID")
    quantity: int = Field(..., gt=0, description="购买数量")

class CancelOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("用户取消订单", description="取消原因")


class RefundOrderRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("用户申请退款", description="退款原因")

class ProductCreateRequest(BaseModel):
    category_name: str = Field(..., min_length=1, max_length=80, description="商品分类名称")
    product_name: str = Field(..., min_length=1, max_length=120, description="商品名称")
    sku_name: str = Field("默认规格", max_length=100, description="SKU 名称，第一版一个商品只对应一个 SKU")
    price: float = Field(..., gt=0, description="SKU 鍞环")
    available_stock: int = Field(..., ge=0, description="初始可用库存")

class AdminStockUpdateRequest(BaseModel):
    sku_id: int = Field(..., gt=0, description="要修改库存的 SKU ID")
    available_stock: int = Field(..., ge=0, description="新的可用库存数量")


class AdminSkuPayload(BaseModel):
    sku_code: str = Field(..., min_length=1, max_length=100)
    sku_name: str | None = Field(None, max_length=100)
    color: str = Field(..., min_length=1, max_length=50)
    size: str = Field(..., min_length=1, max_length=30)
    price: float = Field(..., gt=0)
    stock: int = Field(..., ge=0)
    on_sale: int = Field(1, ge=0, le=1)


class AdminSkuBatchCreateRequest(BaseModel):
    skus: list[AdminSkuPayload] = Field(..., min_length=1)


class AdminSkuUpdateRequest(AdminSkuPayload):
    pass


class AdminProductStatusUpdateRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="要修改状态的商品 ID")
    status: str = Field(..., description="商品状态：ON_SALE 或 OFF_SALE")


class AdminProductDeleteRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="要逻辑删除的商品 ID")


class AdminProductDescriptionUpdateRequest(BaseModel):
    description: str = Field(..., max_length=PRODUCT_DESCRIPTION_MAX_LENGTH)


class AdminLoginRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class AdminShipOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("管理员后台发货", description="发货备注")


class AdminUnshipOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("管理员后台取消发货", description="取消发货备注")


class AdminApproveRefundRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("管理员同意退款", description="处理备注")


class AdminRejectRefundRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("管理员拒绝退款", description="处理备注")


def normalize_product_description(value: str | None) -> str | None:
    normalized = (value or "").strip()
    if len(normalized) > PRODUCT_DESCRIPTION_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="商品介绍不能超过 1000 个字符")
    return normalized or None


@app.get("/")
def root():
    return {
        "message": "Frieren Cloth Shop API is running"
    }


def query_order_detail(conn, order_id: int):
    """
    澶嶇敤璁㈠崟璇︽儏鏌ヨ閫昏緫锛屼緵鐢ㄦ埛绔拰绠＄悊鍛樼鍏卞悓浣跨敤銆?    """
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                order_id,
                order_no,
                user_id,
                email,
                status,
                total_amount,
                item_kind_count,
                total_quantity,
                item_total_amount,
                created_at,
                updated_at
            FROM v_order_summary
            WHERE order_id = %s
            """,
            (order_id,)
        )
        order_summary = cursor.fetchone()

    if not order_summary:
        raise HTTPException(
            status_code=404,
            detail="鐠併垹宕熸稉宥呯摠閸?"
        )

    order_no = order_summary["order_no"]

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                user_id,
                email,
                order_id,
                order_no,
                order_status,
                total_amount,
                order_created_at,
                order_updated_at,
                recipient_name,
                phone,
                address_detail,
                order_item_id,
                product_id,
                product_name,
                sku_id,
                sku_name,
                quantity,
                price,
                item_amount,
                pay_method,
                pay_status,
                pay_amount,
                pay_created_at
            FROM v_user_order_detail
            WHERE order_id = %s
            ORDER BY order_item_id
            """,
            (order_id,)
        )
        order_items = cursor.fetchall()

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                order_id,
                pay_method,
                pay_status,
                pay_amount,
                created_at
            FROM payment_record
            WHERE order_id = %s
            ORDER BY id DESC
            """,
            (order_id,)
        )
        payment_records = cursor.fetchall()

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                order_id,
                from_status,
                to_status,
                remark,
                created_at
            FROM order_status_log
            WHERE order_id = %s
            ORDER BY id
            """,
            (order_id,)
        )
        status_logs = cursor.fetchall()

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                sku_id,
                change_type,
                change_qty,
                ref_no,
                created_at
            FROM inventory_log
            WHERE ref_no = %s
            ORDER BY id
            """,
            (order_no,)
        )
        inventory_logs = cursor.fetchall()

    return {
        "order_summary": order_summary,
        "order_items": order_items,
        "payment_records": payment_records,
        "status_logs": status_logs,
        "inventory_logs": inventory_logs,
    }


def get_previous_status_before_refund_request(conn, order_id: int) -> str:
    """
    获取最近一次退款申请前的订单状态，用于管理员拒绝退款时回退。
    """
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT from_status
            FROM order_status_log
            WHERE order_id = %s
              AND to_status = 'REFUND_REQUESTED'
            ORDER BY id DESC
            LIMIT 1
            """,
            (order_id,)
        )
        row = cursor.fetchone()

    previous_status = str(row.get("from_status") if row else "").strip().upper()

    if previous_status in {"PAID", "SHIPPED"}:
        return previous_status

    return "PAID"


@app.get("/db-test")
def db_test():
    """
    娴嬭瘯 FastAPI 鏄惁鑳芥垚鍔熻繛鎺?MySQL銆?
    """
    try:
        result = test_connection()
        return {
            "success": True,
            "database": result["db_name"],
            "mysql_version": result["mysql_version"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"鏁版嵁搴撹繛鎺ュけ璐ワ細{str(e)}"
        )


@app.get("/products")
def get_products():
    """
    鏌ヨ鍟嗗搧鍒楄〃銆?
    浼樺厛浣跨敤宸叉湁瑙嗗浘 v_product_detail銆?
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT
                        category_id,
                        category_name,
                        product_id,
                        product_name,
                        description,
                        product_id,
                        product_name,
                        image_url,
                        product_status,
                        sku_id,
                        sku_code,
                        sku_name,
                        color_name,
                        size_name,
                        price,
                        sku_status,
                        sku_is_deleted,
                        available_stock,
                        locked_stock,
                        total_sold_count,
                        total_sales_amount,
                        product_created_at,
                        product_updated_at,
                        inventory_updated_at
                    FROM v_product_detail
                    ORDER BY product_id, sku_id
                """
                cursor.execute(sql)
                rows = cursor.fetchall()
                rows = serialize_sku_rows(rows)
                rows = attach_product_images(conn, rows)

        return {
            "success": True,
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询商品列表失败：{str(e)}"
        )


@app.post("/admin/login")
def admin_login(req: AdminLoginRequest):
    """
    绠＄悊鍛樼櫥褰曘€?    """
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, email, is_admin
                    FROM `user`
                    WHERE email = %s
                      AND password_hash = SHA2(%s, 256)
                      AND is_deleted = 0
                    """,
                    (req.email, req.password)
                )
                admin_user = cursor.fetchone()

        if not admin_user:
            raise HTTPException(status_code=401, detail="邮箱或密码错误")

        if int(admin_user.get("is_admin") or 0) != 1:
            raise HTTPException(status_code=403, detail="不是管理员账号")

        admin_user_id = int(admin_user["id"])
        token = create_admin_token(admin_user_id)

        return {
            "success": True,
            "message": "管理员登录成功",
            "admin_user_id": admin_user_id,
            "email": admin_user["email"],
            "admin_token": token,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"绠＄悊鍛樼櫥褰曞け璐ワ細{str(e)}"
        )


def normalize_sku_status(on_sale, index: int) -> str:
    if on_sale in (1, True, "1", "ON_SALE", "on_sale"):
        return "ON_SALE"
    if on_sale in (0, False, "0", "OFF_SALE", "off_sale"):
        return "OFF_SALE"
    raise HTTPException(
        status_code=400,
        detail=f"第 {index} 行 SKU 在售状态只能是 0 或 1"
    )


def normalize_structured_sku_rows(sku_rows: list[dict]) -> list[dict]:
    parsed_rows = []
    seen_codes = set()
    seen_dimensions = set()

    for index, row in enumerate(sku_rows, start=1):
        if not isinstance(row, dict):
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 格式错误")

        sku_code = str(row.get("sku_code") or "").strip()
        color = str(row.get("color") or "").strip()
        size = str(row.get("size") or "").strip()
        sku_name = str(row.get("sku_name") or "").strip() or f"{color} / {size}"
        price_value = row.get("price")
        stock_value = row.get("stock", row.get("available_stock"))
        status = normalize_sku_status(row.get("on_sale", 1), index)

        if not sku_code:
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 编码不能为空")
        if not color:
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 颜色不能为空")
        if not size:
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 尺码不能为空")
        if len(sku_code) > 100 or len(sku_name) > 100 or len(color) > 50 or len(size) > 30:
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 字段长度超出限制")

        try:
            current_price = float(price_value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 价格不正确")

        try:
            current_stock = int(stock_value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 库存不正确")

        if current_price <= 0:
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 价格必须大于 0")
        if isinstance(stock_value, bool) or current_stock < 0 or float(stock_value) != current_stock:
            raise HTTPException(status_code=400, detail=f"第 {index} 行 SKU 库存必须是大于等于 0 的整数")

        code_key = sku_code.casefold()
        dimension_key = (color.casefold(), size.casefold())
        if code_key in seen_codes:
            raise HTTPException(status_code=400, detail=f"SKU 编码重复：{sku_code}")
        if dimension_key in seen_dimensions:
            raise HTTPException(status_code=400, detail=f"颜色和尺码组合重复：{color} / {size}")

        seen_codes.add(code_key)
        seen_dimensions.add(dimension_key)
        parsed_rows.append({
            "sku_code": sku_code,
            "sku_name": sku_name,
            "color": color,
            "size": size,
            "price": current_price,
            "stock": current_stock,
            "available_stock": current_stock,
            "status": status,
            "on_sale": 1 if status == "ON_SALE" else 0,
        })

    return parsed_rows


def parse_product_skus(
    skus_json: str | None,
    sku_name: str,
    price: float,
    available_stock: int
):
    """解析 multipart 中的结构化 SKU JSON，并保留旧单规格兼容入口。"""
    if not skus_json or not skus_json.strip():
        return [
            {
                "sku_code": None,
                "sku_name": (sku_name or "默认规格").strip() or "默认规格",
                "color": None,
                "size": None,
                "price": float(price),
                "stock": int(available_stock),
                "available_stock": int(available_stock),
                "status": "ON_SALE",
                "on_sale": 1,
            }
        ]

    try:
        sku_rows = json.loads(skus_json)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="多 SKU 数据格式错误，必须是 JSON 数组"
        )

    if not isinstance(sku_rows, list) or not sku_rows:
        raise HTTPException(
            status_code=400,
            detail="多 SKU 至少需要填写一条规格"
        )

    return normalize_structured_sku_rows(sku_rows)


def ensure_admin_sku_unique(cursor, product_id: int, sku_row: dict, exclude_sku_id: int = 0) -> None:
    sku_code = sku_row.get("sku_code")
    color = sku_row.get("color")
    size = sku_row.get("size")

    if sku_code:
        cursor.execute(
            """
            SELECT id
            FROM product_sku
            WHERE sku_code = %s
              AND id <> %s
            LIMIT 1
            """,
            (sku_code, exclude_sku_id)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"SKU 编码已存在：{sku_code}")

    if color and size:
        cursor.execute(
            """
            SELECT id
            FROM product_sku
            WHERE product_id = %s
              AND color_name = %s
              AND size_name = %s
              AND is_deleted = 0
              AND id <> %s
            LIMIT 1
            """,
            (product_id, color, size, exclude_sku_id)
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail=f"颜色和尺码组合已存在：{color} / {size}"
            )

@app.post("/products")
async def create_product(
    category_name: str = Form(...),
    product_name: str = Form(...),
    description: str = Form(""),
    sku_name: str = Form("默认规格"),
    price: float = Form(...),
    available_stock: int = Form(...),
    skus_json: str | None = Form(None),
    image: UploadFile | None = File(None),
    images: list[UploadFile] | None = File(None),
    authorization: str | None = Header(None),
):
    """
    后台新增商品。
    第一版：一个商品只创建一个 SKU。
    支持上传商品主图，图片保存到 uploads/products，路径写入 product.image_url。
    """
    require_admin_user(authorization)

    category_name = category_name.strip()
    product_name = product_name.strip()
    description = normalize_product_description(description)
    sku_name = sku_name.strip() or "默认规格"

    if not category_name:
        raise HTTPException(status_code=400, detail="鍟嗗搧鍒嗙被涓嶈兘涓虹┖")

    if not product_name:
        raise HTTPException(status_code=400, detail="鍟嗗搧鍚嶇О涓嶈兘涓虹┖")

    if price <= 0:
        raise HTTPException(status_code=400, detail="鍟嗗搧浠锋牸蹇呴』澶т簬 0")

    if available_stock < 0:
        raise HTTPException(status_code=400, detail="鍒濆搴撳瓨涓嶈兘灏忎簬 0")
    sku_rows = parse_product_skus(
        skus_json=skus_json,
        sku_name=sku_name,
        price=price,
        available_stock=available_stock
    )

    uploaded_images = []
    if image:
        uploaded_images.append(image)
    if images:
        uploaded_images.extend(images)

    saved_images = await save_product_uploads(uploaded_images)

    image_url = saved_images[0] if saved_images else None
    transaction_committed = False
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 鍒嗙被涓嶅瓨鍦ㄥ垯鍒涘缓锛屽凡瀛樺湪鍒欏鐢?
                    cursor.execute(
                        """
                        INSERT INTO category(name, sort_order, is_deleted)
                        VALUES(%s, 0, 0)
                        ON DUPLICATE KEY UPDATE
                            id = LAST_INSERT_ID(id),
                            is_deleted = 0
                        """,
                        (category_name,)
                    )
                    category_id = cursor.lastrowid

                    # 2. 鍐欏叆 product 琛紝淇濆瓨 image_url
                    cursor.execute(
                        """
                        INSERT INTO product(
                            category_id,
                            name,
                            description,
                            image_url,
                            status,
                            is_deleted
                        )
                        VALUES(%s, %s, %s, %s, 'ON_SALE', 0)
                        """,
                        (category_id, product_name, description, image_url)
                    )
                    product_id = cursor.lastrowid
                    # 3. 保存商品图片扩展记录，第一张图片兼容为主图。
                    for sort_order, saved_image_url in enumerate(saved_images):
                        cursor.execute(
                            """
                            INSERT INTO product_image(
                                product_id,
                                image_url,
                                sort_order,
                                is_main,
                                is_deleted
                            )
                            VALUES(%s, %s, %s, %s, 0)
                            """,
                            (
                                product_id,
                                saved_image_url,
                                sort_order,
                                1 if sort_order == 0 else 0,
                            )
                        )

                    # 3. 鍐欏叆 product_sku 琛?
                    sku_ids = []

                    for sku_row in sku_rows:
                        ensure_admin_sku_unique(cursor, product_id, sku_row)
                        cursor.execute(
                            """
                            INSERT INTO product_sku(
                                product_id,
                                sku_code,
                                sku_name,
                                color_name,
                                size_name,
                                price,
                                status,
                                is_deleted
                            )
                            VALUES(%s, %s, %s, %s, %s, %s, %s, 0)
                            """,
                            (
                                product_id,
                                sku_row["sku_code"],
                                sku_row["sku_name"],
                                sku_row["color"],
                                sku_row["size"],
                                sku_row["price"],
                                sku_row["status"],
                            )
                        )
                        sku_id = cursor.lastrowid
                        sku_ids.append(sku_id)

                        cursor.execute(
                            """
                            INSERT INTO inventory(
                                sku_id,
                                available_stock,
                                locked_stock
                            )
                            VALUES(%s, %s, 0)
                            """,
                            (
                                sku_id,
                                sku_row["stock"],
                            )
                        )

                        cursor.execute(
                            """
                            INSERT INTO product_sales_stat(
                                sku_id,
                                total_sold_count,
                                total_sales_amount
                            )
                            VALUES(%s, 0, 0.00)
                            """,
                            (sku_id,)
                        )

                conn.commit()
                transaction_committed = True

                # 6. 新增成功后，从 v_product_detail 查询完整商品信息
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            category_id,
                            category_name,
                            product_id,
                            product_name,
                            description,
                            image_url,
                            product_status,
                            sku_id,
                            sku_code,
                            sku_name,
                            color_name,
                            size_name,
                            price,
                            sku_status,
                            sku_is_deleted,
                            available_stock,
                            locked_stock,
                            total_sold_count,
                            total_sales_amount,
                            product_created_at,
                            product_updated_at,
                            inventory_updated_at
                        FROM v_product_detail
                        WHERE product_id = %s
                        ORDER BY sku_id
                        """,
                        (product_id,)
                    )
                    rows = cursor.fetchall()
                    rows = serialize_sku_rows(rows)
                    rows = attach_product_images(conn, rows)

            except Exception:
                conn.rollback()
                if not transaction_committed:
                    cleanup_saved_product_images(saved_images)
                raise

        return {
            "success": True,
            "message": "新增商品成功",
            "product_id": product_id,
            "sku_ids": sku_ids,
            "sku_count": len(sku_ids),
            "image_url": image_url,
            "data": jsonable_encoder(rows)
        }

    except HTTPException:
        if not transaction_committed:
            cleanup_saved_product_images(saved_images)
        raise

    except MySQLError as e:
        if not transaction_committed:
            cleanup_saved_product_images(saved_images)
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"新增商品失败：{error_message}"
        )

    except Exception as e:
        if not transaction_committed:
            cleanup_saved_product_images(saved_images)
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )


@app.post("/admin/products/{product_id}/images")
async def append_admin_product_images(
    product_id: int,
    images: list[UploadFile] | None = File(None),
    authorization: str | None = Header(None),
):
    require_admin_user(authorization)

    uploaded_images = [image for image in (images or []) if image and image.filename]
    if not uploaded_images:
        raise HTTPException(status_code=400, detail="请至少选择一张商品图片")

    saved_images = []

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, image_url
                        FROM product
                        WHERE id = %s
                          AND is_deleted = 0
                        FOR UPDATE
                        """,
                        (product_id,)
                    )
                    product = cursor.fetchone()

                    if not product:
                        raise HTTPException(status_code=404, detail="商品不存在或已删除")

                    cursor.execute(
                        """
                        SELECT MAX(sort_order) AS max_sort_order
                        FROM product_image
                        WHERE product_id = %s
                          AND is_deleted = 0
                        """,
                        (product_id,)
                    )
                    sort_row = cursor.fetchone() or {}
                    max_sort_order = sort_row.get("max_sort_order")
                    product_image_url = str(product.get("image_url") or "").strip()

                    if max_sort_order is None and product_image_url:
                        cursor.execute(
                            """
                            INSERT INTO product_image(
                                product_id, image_url, sort_order, is_main, is_deleted
                            )
                            VALUES(%s, %s, 0, 1, 0)
                            """,
                            (product_id, product_image_url)
                        )
                        next_sort_order = 1
                    else:
                        next_sort_order = int(max_sort_order) + 1 if max_sort_order is not None else 0

                    saved_images = await save_product_uploads(uploaded_images)
                    first_upload_becomes_main = max_sort_order is None and not product_image_url

                    for index, saved_image_url in enumerate(saved_images):
                        cursor.execute(
                            """
                            INSERT INTO product_image(
                                product_id, image_url, sort_order, is_main, is_deleted
                            )
                            VALUES(%s, %s, %s, %s, 0)
                            """,
                            (
                                product_id,
                                saved_image_url,
                                next_sort_order + index,
                                1 if first_upload_becomes_main and index == 0 else 0,
                            )
                        )

                    if first_upload_becomes_main:
                        product_image_url = saved_images[0]
                        cursor.execute(
                            """
                            UPDATE product
                            SET image_url = %s
                            WHERE id = %s
                            """,
                            (product_image_url, product_id)
                        )

                    image_map = query_product_images(conn, [product_id])
                    product_images = image_map.get(product_id, [])

                conn.commit()

            except Exception:
                conn.rollback()
                cleanup_saved_product_images(saved_images)
                raise

        return {
            "success": True,
            "message": "商品图片追加成功",
            "product_id": product_id,
            "image_url": product_image_url,
            "images": jsonable_encoder(product_images),
            "image_count": len(product_images),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"商品图片追加失败：{str(e)}")


@app.delete("/admin/products/{product_id}/images/{image_id}")
def delete_admin_product_image(
    product_id: int,
    image_id: int,
    authorization: str | None = Header(None),
):
    require_admin_user(authorization)

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, image_url
                        FROM product
                        WHERE id = %s
                          AND is_deleted = 0
                        FOR UPDATE
                        """,
                        (product_id,)
                    )
                    product = cursor.fetchone()

                    if not product:
                        raise HTTPException(status_code=404, detail="商品不存在或已删除")

                    cursor.execute(
                        """
                        SELECT id, product_id, image_url, sort_order, is_main
                        FROM product_image
                        WHERE id = %s
                          AND product_id = %s
                          AND is_deleted = 0
                        FOR UPDATE
                        """,
                        (image_id, product_id)
                    )
                    image = cursor.fetchone()

                    if not image:
                        raise HTTPException(status_code=404, detail="商品图片不存在、已删除或不属于该商品")

                    cursor.execute(
                        """
                        SELECT id, image_url, sort_order, is_main
                        FROM product_image
                        WHERE product_id = %s
                          AND is_deleted = 0
                        ORDER BY sort_order ASC, id ASC
                        FOR UPDATE
                        """,
                        (product_id,)
                    )
                    active_images = cursor.fetchall()

                    if len(active_images) <= 1:
                        raise HTTPException(status_code=400, detail="商品至少需要保留一张图片")

                    cursor.execute(
                        """
                        UPDATE product_image
                        SET is_deleted = 1,
                            is_main = 0
                        WHERE id = %s
                          AND product_id = %s
                          AND is_deleted = 0
                        """,
                        (image_id, product_id)
                    )

                    current_image_url = str(product.get("image_url") or "").strip()

                    if int(image.get("is_main") or 0) == 1:
                        remaining_images = [item for item in active_images if int(item["id"]) != image_id]
                        new_main_image = remaining_images[0]

                        cursor.execute(
                            """
                            UPDATE product_image
                            SET is_main = 0
                            WHERE product_id = %s
                              AND is_deleted = 0
                            """,
                            (product_id,)
                        )
                        cursor.execute(
                            """
                            UPDATE product_image
                            SET is_main = 1
                            WHERE id = %s
                              AND product_id = %s
                              AND is_deleted = 0
                            """,
                            (new_main_image["id"], product_id)
                        )

                        current_image_url = new_main_image["image_url"]
                        cursor.execute(
                            """
                            UPDATE product
                            SET image_url = %s
                            WHERE id = %s
                              AND is_deleted = 0
                            """,
                            (current_image_url, product_id)
                        )

                    image_map = query_product_images(conn, [product_id])
                    product_images = image_map.get(product_id, [])

                conn.commit()

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "商品图片删除成功",
            "product_id": product_id,
            "deleted_image_id": image_id,
            "image_url": current_image_url,
            "images": jsonable_encoder(product_images),
            "image_count": len(product_images),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"商品图片删除失败：{str(e)}")


def query_user_addresses(conn, user_id: int):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                user_id,
                recipient_name,
                phone,
                detail,
                is_default,
                created_at
            FROM user_address
            WHERE user_id = %s
              AND is_deleted = 0
            ORDER BY is_default DESC, id ASC
            """,
            (user_id,)
        )
        return cursor.fetchall()


def query_cart_rows(conn, user_id: int):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                u.id AS user_id,
                u.email,
                c.id AS cart_id,
                ci.id AS cart_item_id,
                p.id AS product_id,
                p.name AS product_name,
                p.status AS product_status,
                p.is_deleted AS product_is_deleted,
                s.id AS sku_id,
                s.sku_name,
                s.status AS sku_status,
                s.is_deleted AS sku_is_deleted,
                s.price,
                ci.quantity,
                (ci.quantity * s.price) AS item_amount,
                COALESCE(i.available_stock, 0) AS available_stock,
                COALESCE(i.locked_stock, 0) AS locked_stock,
                c.status AS cart_status,
                ci.created_at,
                ci.updated_at
            FROM `user` u
            JOIN cart c
              ON u.id = c.user_id
            JOIN cart_item ci
              ON c.id = ci.cart_id
            JOIN product_sku s
              ON ci.sku_id = s.id
            JOIN product p
              ON s.product_id = p.id
            LEFT JOIN inventory i
              ON s.id = i.sku_id
            WHERE u.id = %s
              AND u.is_deleted = 0
              AND c.status = 'ACTIVE'
            ORDER BY ci.id
            """,
            (user_id,)
        )
        return cursor.fetchall()


def validate_sku_for_purchase(conn, sku_id: int, quantity: int) -> dict:
    """在调用既有存储过程前给出清晰校验；存储过程仍负责事务内最终复核。"""
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                s.id AS sku_id,
                s.status AS sku_status,
                s.is_deleted AS sku_is_deleted,
                p.status AS product_status,
                p.is_deleted AS product_is_deleted,
                COALESCE(i.available_stock, 0) AS available_stock
            FROM product_sku s
            JOIN product p ON s.product_id = p.id
            LEFT JOIN inventory i ON s.id = i.sku_id
            WHERE s.id = %s
              AND s.status = 'ON_SALE'
              AND s.is_deleted = 0
              AND p.status = 'ON_SALE'
              AND p.is_deleted = 0
            """,
            (sku_id,)
        )
        sku = cursor.fetchone()

    if not sku:
        raise HTTPException(status_code=400, detail="SKU 不存在、已删除或未上架")
    if int(sku["available_stock"] or 0) < quantity:
        raise HTTPException(status_code=400, detail="SKU 库存不足")
    return sku


@app.get("/addresses/user/{user_id}")
def get_user_addresses(user_id: int):
    """
    鏌ヨ鐢ㄦ埛鏀惰揣鍦板潃鍒楄〃銆?
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        user_id,
                        recipient_name,
                        phone,
                        detail,
                        is_default,
                        created_at
                    FROM user_address
                    WHERE user_id = %s
                      AND is_deleted = 0
                    ORDER BY is_default DESC, id ASC
                    """,
                    (user_id,)
                )
                rows = cursor.fetchall()

        return {
            "success": True,
            "message": "查询用户地址成功",
            "user_id": user_id,
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"查询用户地址失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
        )

@app.post("/addresses/add")
def add_user_address(req: AddressAddRequest):
    """
    新增用户收货地址。
    当前数据库 user_address 表只有 detail 字段，所以前端会把省市区和详细地址合并后传入 detail。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT COUNT(*) AS cnt
                        FROM `user`
                        WHERE id = %s
                          AND is_deleted = 0
                        """,
                        (req.user_id,)
                    )
                    user_check = cursor.fetchone()

                    if not user_check or user_check["cnt"] == 0:
                        raise HTTPException(
                            status_code=400,
                            detail="用户不存在或已删除"
                        )

                    if req.is_default:
                        cursor.execute(
                            """
                            UPDATE user_address
                            SET is_default = 0
                            WHERE user_id = %s
                              AND is_deleted = 0
                            """,
                            (req.user_id,)
                        )

                    cursor.execute(
                        """
                        INSERT INTO user_address(
                            user_id,
                            recipient_name,
                            phone,
                            detail,
                            is_default,
                            is_deleted
                        )
                        VALUES(%s, %s, %s, %s, %s, 0)
                        """,
                        (
                            req.user_id,
                            req.recipient_name,
                            req.phone,
                            req.detail,
                            1 if req.is_default else 0
                        )
                    )

                    address_id = cursor.lastrowid

                conn.commit()

                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            user_id,
                            recipient_name,
                            phone,
                            detail,
                            is_default,
                            created_at
                        FROM user_address
                        WHERE user_id = %s
                          AND is_deleted = 0
                        ORDER BY is_default DESC, id ASC
                        """,
                        (req.user_id,)
                    )
                    rows = cursor.fetchall()

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "新增收货地址成功",
            "address_id": address_id,
            "user_id": req.user_id,
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except HTTPException:
        raise

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"新增收货地址失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/addresses/set-default")
def set_default_address(req: AddressSetDefaultRequest):
    """
    璁剧疆榛樿鏀惰揣鍦板潃銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "CALL sp_set_default_address(%s, %s)",
                        (req.user_id, req.address_id)
                    )

                    while cursor.nextset():
                        pass

                conn.commit()

                rows = query_user_addresses(conn, req.user_id)

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "设置默认地址成功",
            "user_id": req.user_id,
            "address_id": req.address_id,
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"设置默认地址失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/addresses/delete")
def delete_user_address(req: AddressDeleteRequest):
    """
    鍒犻櫎鏀惰揣鍦板潃銆?
    褰撳墠閲囩敤杞垹闄わ細is_deleted = 1銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "CALL sp_delete_user_address(%s, %s)",
                        (req.user_id, req.address_id)
                    )

                    while cursor.nextset():
                        pass

                conn.commit()

                rows = query_user_addresses(conn, req.user_id)

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "删除收货地址成功",
            "user_id": req.user_id,
            "address_id": req.address_id,
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"删除收货地址失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )


@app.get("/cart/{user_id}")
def get_cart(user_id: int):
    """
    鏌ヨ鎸囧畾鐢ㄦ埛鐨勮喘鐗╄溅銆?
    浼樺厛浣跨敤宸叉湁瑙嗗浘 v_user_cart_detail銆?
    """
    try:
        with get_db() as conn:
            rows = query_cart_rows(conn, user_id)

        total_amount = sum(float(row["item_amount"]) for row in rows)

        return {
            "success": True,
            "user_id": user_id,
            "count": len(rows),
            "cart_total_amount": total_amount,
            "data": jsonable_encoder(rows)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询购物车失败：{str(e)}"
        )


@app.post("/cart/add")
def add_to_cart(req: CartAddRequest):
    """
    鍔犲叆璐墿杞︺€?
    璋冪敤宸叉湁瀛樺偍杩囩▼ sp_add_to_cart銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "CALL sp_add_to_cart(%s, %s, %s)",
                        (req.user_id, req.sku_id, req.quantity)
                    )

                conn.commit()

                # 加入成功后，再查询一次用户购物车，方便前端直接刷新页面
                rows = query_cart_rows(conn, req.user_id)

            except Exception:
                conn.rollback()
                raise

        total_amount = sum(float(row["item_amount"]) for row in rows)

        return {
            "success": True,
            "message": "加入购物车成功",
            "user_id": req.user_id,
            "count": len(rows),
            "cart_total_amount": total_amount,
            "data": jsonable_encoder(rows)
        }

    except HTTPException:
        raise

    except MySQLError as e:
        # MySQL 瀛樺偍杩囩▼ SIGNAL 鎶涘嚭鐨勯敊璇紝閫氬父鍦?e.args[1]
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"加入购物车失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )


@app.post("/cart/update-quantity")
def update_cart_quantity(req: CartUpdateQuantityRequest):
    """
    淇敼璐墿杞﹀晢鍝佹暟閲忋€?
    璋冪敤瀛樺偍杩囩▼ sp_update_cart_item_quantity銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "CALL sp_update_cart_item_quantity(%s, %s, %s)",
                        (req.user_id, req.cart_item_id, req.quantity)
                    )

                    while cursor.nextset():
                        pass

                conn.commit()

                rows = query_cart_rows(conn, req.user_id)

            except Exception:
                conn.rollback()
                raise

        total_amount = sum(float(row["item_amount"]) for row in rows)

        return {
            "success": True,
            "message": "修改购物车数量成功",
            "user_id": req.user_id,
            "count": len(rows),
            "cart_total_amount": total_amount,
            "data": jsonable_encoder(rows)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"修改购物车数量失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/cart/delete-item")
def delete_cart_item(req: CartDeleteItemRequest):
    """
    鍒犻櫎璐墿杞︿腑鐨勫崟涓晢鍝併€?
    璋冪敤瀛樺偍杩囩▼ sp_delete_cart_item銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "CALL sp_delete_cart_item(%s, %s)",
                        (req.user_id, req.cart_item_id)
                    )

                    while cursor.nextset():
                        pass

                conn.commit()

                rows = query_cart_rows(conn, req.user_id)

            except Exception:
                conn.rollback()
                raise

        total_amount = sum(float(row["item_amount"]) for row in rows)

        return {
            "success": True,
            "message": "删除购物车商品成功",
            "user_id": req.user_id,
            "count": len(rows),
            "cart_total_amount": total_amount,
            "data": jsonable_encoder(rows)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"删除购物车商品失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/orders/from-cart")
def create_order_from_cart(req: OrderFromCartRequest):
    """
    浠庤喘鐗╄溅鍒涘缓璁㈠崟銆?
    璋冪敤宸叉湁瀛樺偍杩囩▼ sp_create_order_from_cart銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 璋冪敤瀛樺偍杩囩▼锛屼娇鐢?MySQL 鐢ㄦ埛鍙橀噺鎺ユ敹 OUT 鍙傛暟
                    cursor.execute(
                        """
                        CALL sp_create_order_from_cart(
                            %s,
                            %s,
                            @new_order_id,
                            @new_order_no
                        )
                        """,
                        (req.user_id, req.address_id)
                    )

                    # 2. 娓呯悊鍙兘瀛樺湪鐨勭粨鏋滈泦锛岄伩鍏嶅悗缁?SELECT 鍑洪敊
                    while cursor.nextset():
                        pass

                    # 3. 璇诲彇瀛樺偍杩囩▼ OUT 鍙傛暟
                    cursor.execute(
                        """
                        SELECT
                            @new_order_id AS order_id,
                            @new_order_no AS order_no
                        """
                    )
                    order_result = cursor.fetchone()

                conn.commit()

                order_id = order_result["order_id"]
                order_no = order_result["order_no"]

                # 4. 鏌ヨ璁㈠崟姹囨€讳俊鎭?
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            order_id,
                            order_no,
                            user_id,
                            email,
                            status,
                            total_amount,
                            item_kind_count,
                            total_quantity,
                            item_total_amount,
                            created_at,
                            updated_at
                        FROM v_order_summary
                        WHERE order_id = %s
                        """,
                        (order_id,)
                    )
                    order_summary = cursor.fetchone()

                # 5. 鏌ヨ璁㈠崟鏄庣粏淇℃伅
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            user_id,
                            email,
                            order_id,
                            order_no,
                            order_status,
                            total_amount,
                            order_created_at,
                            recipient_name,
                            phone,
                            address_detail,
                            order_item_id,
                            product_id,
                            product_name,
                            sku_id,
                            sku_name,
                            quantity,
                            price,
                            item_amount,
                            pay_method,
                            pay_status,
                            pay_amount,
                            pay_created_at
                        FROM v_user_order_detail
                        WHERE order_id = %s
                        ORDER BY order_item_id
                        """,
                        (order_id,)
                    )
                    order_items = cursor.fetchall()

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "从购物车创建订单成功",
            "order_id": order_id,
            "order_no": order_no,
            "order_summary": jsonable_encoder(order_summary),
            "order_items": jsonable_encoder(order_items)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"从购物车创建订单失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/orders/from-cart-selected")
def create_order_from_selected_cart(req: OrderFromSelectedCartRequest):
    """
    从购物车中选中的商品创建订单。
    调用存储过程 sp_create_order_from_selected_cart_items。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        CALL sp_create_order_from_selected_cart_items(
                            %s,
                            %s,
                            %s,
                            @selected_order_id,
                            @selected_order_no
                        )
                        """,
                        (
                            req.user_id,
                            req.address_id,
                            json.dumps(req.cart_item_ids)
                        )
                    )

                    while cursor.nextset():
                        pass

                    cursor.execute(
                        """
                        SELECT
                            @selected_order_id AS order_id,
                            @selected_order_no AS order_no
                        """
                    )
                    order_result = cursor.fetchone()

                conn.commit()

                order_id = order_result["order_id"]
                order_no = order_result["order_no"]

                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            order_id,
                            order_no,
                            user_id,
                            email,
                            status,
                            total_amount,
                            item_kind_count,
                            total_quantity,
                            item_total_amount,
                            created_at,
                            updated_at
                        FROM v_order_summary
                        WHERE order_id = %s
                        """,
                        (order_id,)
                    )
                    order_summary = cursor.fetchone()

                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            user_id,
                            email,
                            order_id,
                            order_no,
                            order_status,
                            total_amount,
                            order_created_at,
                            recipient_name,
                            phone,
                            address_detail,
                            order_item_id,
                            product_id,
                            product_name,
                            sku_id,
                            sku_name,
                            quantity,
                            price,
                            item_amount,
                            pay_method,
                            pay_status,
                            pay_amount,
                            pay_created_at
                        FROM v_user_order_detail
                        WHERE order_id = %s
                        ORDER BY order_item_id
                        """,
                        (order_id,)
                    )
                    order_items = cursor.fetchall()

                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            sku_id,
                            change_type,
                            change_qty,
                            ref_no,
                            created_at
                        FROM inventory_log
                        WHERE ref_no = %s
                        ORDER BY id
                        """,
                        (order_no,)
                    )
                    inventory_logs = cursor.fetchall()

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "从购物车选中商品创建订单成功",
            "order_id": order_id,
            "order_no": order_no,
            "order_summary": jsonable_encoder(order_summary),
            "order_items": jsonable_encoder(order_items),
            "inventory_logs": jsonable_encoder(inventory_logs)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"从购物车选中商品创建订单失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )


@app.post("/orders/pay")
def pay_order(req: PayOrderRequest):
    """
    鏀粯璁㈠崟銆?
    鍏堟牎楠岀敤鎴枫€佽鍗曞綊灞炲拰鏀粯瀵嗙爜锛屾牎楠岄€氳繃鍚庤皟鐢?sp_pay_order銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 鏍￠獙鏀粯瀵嗙爜
                    cursor.execute(
                        """
                        SELECT COUNT(*) AS cnt
                        FROM `user`
                        WHERE id = %s
                          AND is_deleted = 0
                          AND pay_password_hash = SHA2(%s, 256)
                        """,
                        (req.user_id, req.pay_password)
                    )
                    password_check = cursor.fetchone()

                    if not password_check or password_check["cnt"] == 0:
                        raise HTTPException(
                            status_code=400,
                            detail="支付密码错误"
                        )

                    # 2. 鏍￠獙璁㈠崟鏄惁灞炰簬褰撳墠鐢ㄦ埛
                    cursor.execute(
                        """
                        SELECT COUNT(*) AS cnt
                        FROM order_main
                        WHERE id = %s
                          AND user_id = %s
                        """,
                        (req.order_id, req.user_id)
                    )
                    order_check = cursor.fetchone()

                    if not order_check or order_check["cnt"] == 0:
                        raise HTTPException(
                            status_code=400,
                            detail="订单不存在或不属于当前用户"
                        )

                    # 3. 璋冪敤鍘熸湁鏀粯瀛樺偍杩囩▼
                    cursor.execute(
                        "CALL sp_pay_order(%s, %s)",
                        (req.order_id, req.pay_method)
                    )

                    while cursor.nextset():
                        pass

                conn.commit()

                # 4. 鏌ヨ鏀粯鍚庣殑璁㈠崟姒傝
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            order_id,
                            order_no,
                            user_id,
                            email,
                            status,
                            total_amount,
                            item_kind_count,
                            total_quantity,
                            item_total_amount,
                            created_at,
                            updated_at
                        FROM v_order_summary
                        WHERE order_id = %s
                        """,
                        (req.order_id,)
                    )
                    order_summary = cursor.fetchone()

                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            order_id,
                            pay_method,
                            pay_status,
                            pay_amount,
                            created_at
                        FROM payment_record
                        WHERE order_id = %s
                        ORDER BY id DESC
                        """,
                        (req.order_id,)
                    )
                    payment_records = cursor.fetchall()

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "订单支付成功",
            "order_id": req.order_id,
            "order_summary": jsonable_encoder(order_summary),
            "payment_records": jsonable_encoder(payment_records)
        }

    except HTTPException:
        raise

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"订单支付失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/orders/direct")
def create_direct_order(req: DirectOrderRequest):
    """
    鐩存帴涓嬪崟 / 绔嬪嵆璐拱銆?
    璋冪敤宸叉湁瀛樺偍杩囩▼ sp_create_direct_order銆?
    """
    try:
        with get_db() as conn:
            try:
                validate_sku_for_purchase(conn, req.sku_id, req.quantity)
                with conn.cursor() as cursor:
                    # 1. 璋冪敤鐩存帴涓嬪崟瀛樺偍杩囩▼锛岀敤 MySQL 鐢ㄦ埛鍙橀噺鎺ユ敹 OUT 鍙傛暟
                    cursor.execute(
                        """
                        CALL sp_create_direct_order(
                            %s,
                            %s,
                            %s,
                            %s,
                            @direct_order_id,
                            @direct_order_no
                        )
                        """,
                        (
                            req.user_id,
                            req.address_id,
                            req.sku_id,
                            req.quantity
                        )
                    )

                    # 2. 娓呯悊鍙兘瀛樺湪鐨勭粨鏋滈泦
                    while cursor.nextset():
                        pass

                    # 3. 璇诲彇 OUT 鍙傛暟
                    cursor.execute(
                        """
                        SELECT
                            @direct_order_id AS order_id,
                            @direct_order_no AS order_no
                        """
                    )
                    order_result = cursor.fetchone()

                conn.commit()

                order_id = order_result["order_id"]
                order_no = order_result["order_no"]

                # 4. 鏌ヨ璁㈠崟姹囨€?
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            order_id,
                            order_no,
                            user_id,
                            email,
                            status,
                            total_amount,
                            item_kind_count,
                            total_quantity,
                            item_total_amount,
                            created_at,
                            updated_at
                        FROM v_order_summary
                        WHERE order_id = %s
                        """,
                        (order_id,)
                    )
                    order_summary = cursor.fetchone()

                # 5. 鏌ヨ璁㈠崟鏄庣粏
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            user_id,
                            email,
                            order_id,
                            order_no,
                            order_status,
                            total_amount,
                            order_created_at,
                            recipient_name,
                            phone,
                            address_detail,
                            order_item_id,
                            product_id,
                            product_name,
                            sku_id,
                            sku_name,
                            quantity,
                            price,
                            item_amount,
                            pay_method,
                            pay_status,
                            pay_amount,
                            pay_created_at
                        FROM v_user_order_detail
                        WHERE order_id = %s
                        ORDER BY order_item_id
                        """,
                        (order_id,)
                    )
                    order_items = cursor.fetchall()

                # 6. 查询库存流水，确认库存已经被锁定
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            sku_id,
                            change_type,
                            change_qty,
                            ref_no,
                            created_at
                        FROM inventory_log
                        WHERE ref_no = %s
                        ORDER BY id
                        """,
                        (order_no,)
                    )
                    inventory_logs = cursor.fetchall()

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "直接下单成功",
            "order_id": order_id,
            "order_no": order_no,
            "order_summary": jsonable_encoder(order_summary),
            "order_items": jsonable_encoder(order_items),
            "inventory_logs": jsonable_encoder(inventory_logs)
        }

    except HTTPException:
        raise

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"直接下单失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/orders/cancel")
def cancel_order(req: CancelOrderRequest):
    """
    鍙栨秷璁㈠崟銆?
    璋冪敤宸叉湁瀛樺偍杩囩▼ sp_cancel_order銆?
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 璋冪敤鍙栨秷璁㈠崟瀛樺偍杩囩▼
                    cursor.execute(
                        "CALL sp_cancel_order(%s, %s)",
                        (req.order_id, req.remark)
                    )

                    # 2. 娓呯悊鍙兘瀛樺湪鐨勭粨鏋滈泦
                    while cursor.nextset():
                        pass

                conn.commit()

                # 3. 鏌ヨ璁㈠崟姹囨€?
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            order_id,
                            order_no,
                            user_id,
                            email,
                            status,
                            total_amount,
                            item_kind_count,
                            total_quantity,
                            item_total_amount,
                            created_at,
                            updated_at
                        FROM v_order_summary
                        WHERE order_id = %s
                        """,
                        (req.order_id,)
                    )
                    order_summary = cursor.fetchone()

                # 4. 鏌ヨ璁㈠崟鐘舵€佹棩蹇?
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            order_id,
                            from_status,
                            to_status,
                            remark,
                            created_at
                        FROM order_status_log
                        WHERE order_id = %s
                        ORDER BY id
                        """,
                        (req.order_id,)
                    )
                    status_logs = cursor.fetchall()

                # 5. 鏍规嵁璁㈠崟鍙锋煡璇㈠簱瀛樻祦姘?
                order_no = order_summary["order_no"] if order_summary else None

                inventory_logs = []
                if order_no:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            """
                            SELECT
                                id,
                                sku_id,
                                change_type,
                                change_qty,
                                ref_no,
                                created_at
                            FROM inventory_log
                            WHERE ref_no = %s
                            ORDER BY id
                            """,
                            (order_no,)
                        )
                        inventory_logs = cursor.fetchall()

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "订单取消成功",
            "order_id": req.order_id,
            "order_summary": jsonable_encoder(order_summary),
            "status_logs": jsonable_encoder(status_logs),
            "inventory_logs": jsonable_encoder(inventory_logs)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"取消订单失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )

@app.post("/orders/refund")
def refund_order(req: RefundOrderRequest):
    """
    用户申请退款，先将订单流转到退款待处理。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            order_no,
                            user_id,
                            status,
                            total_amount
                        FROM order_main
                        WHERE id = %s
                          AND user_id = %s
                        FOR UPDATE
                        """,
                        (req.order_id, req.user_id)
                    )
                    order_row = cursor.fetchone()

                    if not order_row:
                        raise HTTPException(
                            status_code=404,
                            detail="订单不存在或不属于当前用户"
                        )

                    current_status = str(order_row.get("status") or "").strip().upper()

                    if current_status not in {"PAID", "SHIPPED"}:
                        status_error_messages = {
                            "PENDING_PAYMENT": "未支付订单不能申请退款",
                            "CANCELLED": "已取消订单不能申请退款",
                            "REFUND_REQUESTED": "退款申请已提交，请勿重复申请",
                            "REFUNDED": "订单已经退款",
                        }
                        raise HTTPException(
                            status_code=400,
                            detail=status_error_messages.get(
                                current_status,
                                f"订单当前状态 {current_status or 'UNKNOWN'} 不能申请退款"
                            )
                        )

                    cursor.execute(
                        """
                        UPDATE order_main
                        SET status = 'REFUND_REQUESTED'
                        WHERE id = %s
                        """,
                        (req.order_id,)
                    )

                conn.commit()

                with get_db() as detail_conn:
                    detail = query_order_detail(detail_conn, req.order_id)

                return {
                    "success": True,
                    "message": "退款申请已提交，等待商家处理",
                    "order_id": req.order_id,
                    "order_summary": jsonable_encoder(detail["order_summary"]),
                    "order_items": jsonable_encoder(detail["order_items"]),
                    "payment_records": jsonable_encoder(detail["payment_records"]),
                    "status_logs": jsonable_encoder(detail["status_logs"]),
                    "inventory_logs": jsonable_encoder(detail["inventory_logs"]),
                }

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"订单退款失败：{str(e)}"
        )


@app.post("/admin/orders/refund/approve")
def approve_admin_refund(req: AdminApproveRefundRequest, authorization: str | None = Header(None)):
    """
    管理员同意退款。
    """
    try:
        admin_user = require_admin_user(authorization)
        action_type = "ADMIN_APPROVE_REFUND"

        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            order_no,
                            status,
                            total_amount
                        FROM order_main
                        WHERE id = %s
                        FOR UPDATE
                        """,
                        (req.order_id,)
                    )
                    order_row = cursor.fetchone()

                    if not order_row:
                        raise HTTPException(
                            status_code=404,
                            detail="订单不存在"
                        )

                    current_status = str(order_row.get("status") or "").strip().upper()

                    if current_status != "REFUND_REQUESTED":
                        raise HTTPException(
                            status_code=400,
                            detail="只有退款待处理订单才能同意退款"
                        )

                    cursor.execute(
                        """
                        UPDATE inventory i
                        JOIN order_item oi ON i.sku_id = oi.sku_id
                        SET i.available_stock = i.available_stock + oi.quantity
                        WHERE oi.order_id = %s
                        """,
                        (req.order_id,)
                    )

                    cursor.execute(
                        """
                        INSERT INTO inventory_log(
                            sku_id,
                            change_type,
                            change_qty,
                            ref_no
                        )
                        SELECT
                            oi.sku_id,
                            'REFUND_RESTORE',
                            oi.quantity,
                            %s
                        FROM order_item oi
                        WHERE oi.order_id = %s
                        """,
                        (order_row["order_no"], req.order_id)
                    )

                    cursor.execute(
                        """
                        INSERT INTO payment_record(
                            order_id,
                            pay_method,
                            pay_status,
                            pay_amount
                        )
                        VALUES(%s, 'REFUND', 'SUCCESS', %s)
                        """,
                        (req.order_id, order_row.get("total_amount") or 0)
                    )

                    cursor.execute(
                        """
                        UPDATE product_sales_stat stat
                        JOIN (
                            SELECT
                                sku_id,
                                SUM(quantity) AS refund_qty,
                                SUM(quantity * price) AS refund_amount
                            FROM order_item
                            WHERE order_id = %s
                            GROUP BY sku_id
                        ) refund_items ON stat.sku_id = refund_items.sku_id
                        SET
                            stat.total_sold_count = GREATEST(0, stat.total_sold_count - refund_items.refund_qty),
                            stat.total_sales_amount = GREATEST(0, stat.total_sales_amount - refund_items.refund_amount)
                        """,
                        (req.order_id,)
                    )

                    cursor.execute(
                        """
                        UPDATE order_main
                        SET status = 'REFUNDED'
                        WHERE id = %s
                        """,
                        (req.order_id,)
                    )

                conn.commit()

                with get_db() as detail_conn:
                    detail = query_order_detail(detail_conn, req.order_id)

                return {
                    "success": True,
                    "message": "退款已同意",
                    "admin_user_id": admin_user["id"],
                    "action_type": action_type,
                    "order_id": req.order_id,
                    "status": "REFUNDED",
                    "order_summary": jsonable_encoder(detail["order_summary"]),
                    "order_items": jsonable_encoder(detail["order_items"]),
                    "payment_records": jsonable_encoder(detail["payment_records"]),
                    "status_logs": jsonable_encoder(detail["status_logs"]),
                    "inventory_logs": jsonable_encoder(detail["inventory_logs"]),
                }

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"同意退款失败：{str(e)}"
        )


@app.post("/admin/orders/refund/reject")
def reject_admin_refund(req: AdminRejectRefundRequest, authorization: str | None = Header(None)):
    """
    管理员拒绝退款。
    """
    try:
        admin_user = require_admin_user(authorization)
        action_type = "ADMIN_REJECT_REFUND"

        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            id,
                            order_no,
                            status
                        FROM order_main
                        WHERE id = %s
                        FOR UPDATE
                        """,
                        (req.order_id,)
                    )
                    order_row = cursor.fetchone()

                    if not order_row:
                        raise HTTPException(
                            status_code=404,
                            detail="订单不存在"
                        )

                    current_status = str(order_row.get("status") or "").strip().upper()

                    if current_status != "REFUND_REQUESTED":
                        raise HTTPException(
                            status_code=400,
                            detail="只有退款待处理订单才能拒绝退款"
                        )

                    previous_status = get_previous_status_before_refund_request(conn, req.order_id)

                    cursor.execute(
                        """
                        UPDATE order_main
                        SET status = %s
                        WHERE id = %s
                        """,
                        (previous_status, req.order_id)
                    )

                conn.commit()

                with get_db() as detail_conn:
                    detail = query_order_detail(detail_conn, req.order_id)

                return {
                    "success": True,
                    "message": "已拒绝退款申请",
                    "admin_user_id": admin_user["id"],
                    "action_type": action_type,
                    "order_id": req.order_id,
                    "status": previous_status,
                    "order_summary": jsonable_encoder(detail["order_summary"]),
                    "order_items": jsonable_encoder(detail["order_items"]),
                    "payment_records": jsonable_encoder(detail["payment_records"]),
                    "status_logs": jsonable_encoder(detail["status_logs"]),
                    "inventory_logs": jsonable_encoder(detail["inventory_logs"]),
                }

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"拒绝退款失败：{str(e)}"
        )


@app.get("/orders/user/{user_id}")
def get_user_orders(user_id: int):
    """
    鏌ヨ鏌愪釜鐢ㄦ埛鐨勮鍗曞垪琛ㄣ€?
    浣跨敤宸叉湁瑙嗗浘 v_order_summary銆?
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        order_id,
                        order_no,
                        user_id,
                        email,
                        status,
                        total_amount,
                        item_kind_count,
                        total_quantity,
                        item_total_amount,
                        created_at,
                        updated_at
                    FROM v_order_summary
                    WHERE user_id = %s
                    ORDER BY created_at DESC, order_id DESC
                    """,
                    (user_id,)
                )
                rows = cursor.fetchall()

        return {
            "success": True,
            "user_id": user_id,
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询用户订单列表失败：{str(e)}"
        )

@app.get("/admin/orders")
def get_admin_orders(authorization: str | None = Header(None)):
    """
    鍚庡彴璁㈠崟鍒楄〃銆?    绗竴鐗堟殏涓嶅仛鏉冮檺鏍￠獙锛岀洿鎺ユ煡璇㈠叏閮ㄨ鍗曟眹鎬汇€?    """
    try:
        require_admin_user(authorization)

        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        order_id,
                        order_no,
                        user_id,
                        email,
                        status,
                        total_amount,
                        item_kind_count,
                        total_quantity,
                        item_total_amount,
                        created_at,
                        updated_at
                    FROM v_order_summary
                    ORDER BY created_at DESC, order_id DESC
                    """
                )
                rows = cursor.fetchall()

        return {
            "success": True,
            "message": "查询后台订单列表成功",
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询后台订单列表失败：{str(e)}"
        )


@app.get("/admin/orders/{order_id}")
def get_admin_order_detail(order_id: int, authorization: str | None = Header(None)):
    """
    后台订单详情。
    """
    try:
        require_admin_user(authorization)

        with get_db() as conn:
            detail = query_order_detail(conn, order_id)

        return {
            "success": True,
            "order_id": order_id,
            "order_summary": jsonable_encoder(detail["order_summary"]),
            "order_items": jsonable_encoder(detail["order_items"]),
            "payment_records": jsonable_encoder(detail["payment_records"]),
            "status_logs": jsonable_encoder(detail["status_logs"]),
            "inventory_logs": jsonable_encoder(detail["inventory_logs"]),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询后台订单详情失败：{str(e)}"
        )


@app.post("/admin/orders/ship")
def ship_admin_order(req: AdminShipOrderRequest, authorization: str | None = Header(None)):
    """
    管理员发货。
    """
    try:
        admin_user = require_admin_user(authorization)

        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, status
                        FROM order_main
                        WHERE id = %s
                        FOR UPDATE
                        """,
                        (req.order_id,)
                    )
                    order_row = cursor.fetchone()

                    if not order_row:
                        raise HTTPException(
                            status_code=404,
                            detail="订单不存在"
                        )

                    current_status = str(order_row.get("status") or "").strip().upper()

                    if current_status != "PAID":
                        raise HTTPException(
                            status_code=400,
                            detail="只有已支付订单才能发货"
                        )

                    cursor.execute(
                        """
                        UPDATE order_main
                        SET status = 'SHIPPED'
                        WHERE id = %s
                        """,
                        (req.order_id,)
                    )

                conn.commit()

                with get_db() as detail_conn:
                    detail = query_order_detail(detail_conn, req.order_id)

                return {
                    "success": True,
                    "message": "订单发货成功",
                    "admin_user_id": admin_user["id"],
                    "order_id": req.order_id,
                    "order_summary": jsonable_encoder(detail["order_summary"]),
                    "order_items": jsonable_encoder(detail["order_items"]),
                    "payment_records": jsonable_encoder(detail["payment_records"]),
                    "status_logs": jsonable_encoder(detail["status_logs"]),
                    "inventory_logs": jsonable_encoder(detail["inventory_logs"]),
                }

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"后台发货失败：{str(e)}"
        )


@app.post("/admin/orders/unship")
def unship_admin_order(req: AdminUnshipOrderRequest, authorization: str | None = Header(None)):
    """
    管理员取消发货。
    """
    try:
        admin_user = require_admin_user(authorization)
        action_type = "ADMIN_UNSHIP_ORDER"

        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, status
                        FROM order_main
                        WHERE id = %s
                        FOR UPDATE
                        """,
                        (req.order_id,)
                    )
                    order_row = cursor.fetchone()

                    if not order_row:
                        raise HTTPException(
                            status_code=404,
                            detail="订单不存在"
                        )

                    current_status = str(order_row.get("status") or "").strip().upper()

                    if current_status != "SHIPPED":
                        raise HTTPException(
                            status_code=400,
                            detail="只有已发货订单才能取消发货"
                        )

                    cursor.execute(
                        "UPDATE order_main SET status = 'PAID' WHERE id = %s",
                        (req.order_id,)
                    )

                conn.commit()

                with get_db() as detail_conn:
                    detail = query_order_detail(detail_conn, req.order_id)

                return {
                    "success": True,
                    "message": "取消发货成功",
                    "admin_user_id": admin_user["id"],
                    "action_type": action_type,
                    "order_id": req.order_id,
                    "order_summary": jsonable_encoder(detail["order_summary"]),
                    "order_items": jsonable_encoder(detail["order_items"]),
                    "payment_records": jsonable_encoder(detail["payment_records"]),
                    "status_logs": jsonable_encoder(detail["status_logs"]),
                    "inventory_logs": jsonable_encoder(detail["inventory_logs"]),
                }

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"后台取消发货失败：{str(e)}"
        )


@app.get("/admin/stats")
def get_admin_stats(authorization: str | None = Header(None)):
    """
    后台销量统计。
    第一版暂不做权限校验，统计真实数据库订单、商品、销量排行。
    """
    try:
        require_admin_user(authorization)

        with get_db() as conn:
            with conn.cursor() as cursor:
                # 1. 璁㈠崟涓庨攢鍞姹囨€?
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS total_order_count,
                        SUM(CASE WHEN status IN ('PAID', 'SHIPPED', 'COMPLETED', 'REFUND_REQUESTED') THEN 1 ELSE 0 END) AS paid_order_count,
                        SUM(CASE WHEN status = 'PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending_order_count,
                        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_order_count,
                        COALESCE(SUM(CASE WHEN status IN ('PAID', 'SHIPPED', 'COMPLETED', 'REFUND_REQUESTED') THEN total_amount ELSE 0 END), 0.00) AS total_revenue,
                        COALESCE(SUM(CASE WHEN status IN ('PAID', 'SHIPPED', 'COMPLETED', 'REFUND_REQUESTED') THEN total_quantity ELSE 0 END), 0) AS total_units_sold
                    FROM v_order_summary
                    """
                )
                summary = cursor.fetchone()

                # 2. 鍟嗗搧鎬绘暟
                cursor.execute(
                    """
                    SELECT COUNT(*) AS total_product_count
                    FROM product
                    WHERE is_deleted = 0
                    """
                )
                product_count_row = cursor.fetchone()

                # 3. 商品销量排行
                cursor.execute(
                    """
                    SELECT
                        category_name,
                        product_id,
                        product_name,
                        sku_id,
                        sku_name,
                        price,
                        total_sold_count,
                        total_sales_amount,
                        sales_rank
                    FROM v_product_sales_rank
                    ORDER BY sales_rank ASC, sku_id ASC
                    LIMIT 20
                    """
                )
                rows = cursor.fetchall()

        return {
            "success": True,
            "message": "查询后台销量统计成功",
            "summary": {
                "total_revenue": float(summary["total_revenue"] or 0),
                "total_order_count": int(summary["total_order_count"] or 0),
                "paid_order_count": int(summary["paid_order_count"] or 0),
                "pending_order_count": int(summary["pending_order_count"] or 0),
                "cancelled_order_count": int(summary["cancelled_order_count"] or 0),
                "total_units_sold": int(summary["total_units_sold"] or 0),
                "total_product_count": int(product_count_row["total_product_count"] or 0),
            },
            "rows": jsonable_encoder(rows)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询后台销量统计失败：{str(e)}"
        )

def admin_sku_payload_to_row(payload: AdminSkuPayload) -> dict:
    return normalize_structured_sku_rows([{
        "sku_code": payload.sku_code,
        "sku_name": payload.sku_name,
        "color": payload.color,
        "size": payload.size,
        "price": payload.price,
        "stock": payload.stock,
        "on_sale": payload.on_sale,
    }])[0]


def query_admin_product_skus(conn, product_id: int) -> list[dict]:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                p.id AS product_id,
                p.name AS product_name,
                p.status AS product_status,
                s.id AS sku_id,
                s.sku_code,
                s.sku_name,
                s.color_name,
                s.size_name,
                s.price,
                s.status AS sku_status,
                s.is_deleted AS sku_is_deleted,
                COALESCE(i.available_stock, 0) AS available_stock,
                COALESCE(i.locked_stock, 0) AS locked_stock,
                i.updated_at AS inventory_updated_at
            FROM product p
            JOIN product_sku s ON p.id = s.product_id
            LEFT JOIN inventory i ON s.id = i.sku_id
            WHERE p.id = %s
              AND p.is_deleted = 0
            ORDER BY s.is_deleted ASC, s.id ASC
            """,
            (product_id,)
        )
        return serialize_sku_rows(cursor.fetchall())


@app.patch("/admin/products/{product_id}/description")
def update_admin_product_description(
    product_id: int,
    req: AdminProductDescriptionUpdateRequest,
    authorization: str | None = Header(None),
):
    require_admin_user(authorization)
    description = normalize_product_description(req.description)

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT id FROM product WHERE id = %s AND is_deleted = 0 FOR UPDATE",
                        (product_id,)
                    )
                    if not cursor.fetchone():
                        raise HTTPException(status_code=404, detail="商品不存在或已删除")

                    cursor.execute(
                        "UPDATE product SET description = %s WHERE id = %s AND is_deleted = 0",
                        (description, product_id)
                    )
                conn.commit()
            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "商品介绍更新成功",
            "product_id": product_id,
            "description": description,
        }
    except HTTPException:
        raise
    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(status_code=400, detail=f"修改商品介绍失败：{error_message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"修改商品介绍失败：{str(e)}")


@app.get("/admin/products/{product_id}/skus")
def get_admin_product_skus(product_id: int, authorization: str | None = Header(None)):
    require_admin_user(authorization)
    try:
        with get_db() as conn:
            rows = query_admin_product_skus(conn, product_id)
        if not rows:
            raise HTTPException(status_code=404, detail="商品不存在或没有 SKU")
        return {
            "success": True,
            "message": "查询商品 SKU 成功",
            "product_id": product_id,
            "count": len(rows),
            "data": jsonable_encoder(rows),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询商品 SKU 失败：{str(e)}")


@app.post("/admin/products/{product_id}/skus")
def create_admin_product_skus(
    product_id: int,
    req: AdminSkuBatchCreateRequest,
    authorization: str | None = Header(None),
):
    require_admin_user(authorization)
    sku_rows = normalize_structured_sku_rows([
        {
            "sku_code": item.sku_code,
            "sku_name": item.sku_name,
            "color": item.color,
            "size": item.size,
            "price": item.price,
            "stock": item.stock,
            "on_sale": item.on_sale,
        }
        for item in req.skus
    ])

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id
                        FROM product
                        WHERE id = %s AND is_deleted = 0
                        FOR UPDATE
                        """,
                        (product_id,)
                    )
                    if not cursor.fetchone():
                        raise HTTPException(status_code=404, detail="商品不存在或已删除")

                    created_sku_ids = []
                    for sku_row in sku_rows:
                        ensure_admin_sku_unique(cursor, product_id, sku_row)
                        cursor.execute(
                            """
                            INSERT INTO product_sku(
                                product_id, sku_code, sku_name, color_name,
                                size_name, price, status, is_deleted
                            )
                            VALUES(%s, %s, %s, %s, %s, %s, %s, 0)
                            """,
                            (
                                product_id,
                                sku_row["sku_code"],
                                sku_row["sku_name"],
                                sku_row["color"],
                                sku_row["size"],
                                sku_row["price"],
                                sku_row["status"],
                            )
                        )
                        sku_id = cursor.lastrowid
                        created_sku_ids.append(sku_id)
                        cursor.execute(
                            """
                            INSERT INTO inventory(sku_id, available_stock, locked_stock)
                            VALUES(%s, %s, 0)
                            """,
                            (sku_id, sku_row["stock"])
                        )
                        cursor.execute(
                            """
                            INSERT INTO product_sales_stat(sku_id, total_sold_count, total_sales_amount)
                            VALUES(%s, 0, 0.00)
                            """,
                            (sku_id,)
                        )
                conn.commit()
                rows = query_admin_product_skus(conn, product_id)
            except HTTPException:
                conn.rollback()
                raise
            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "新增 SKU 组合成功",
            "product_id": product_id,
            "sku_ids": created_sku_ids,
            "count": len(created_sku_ids),
            "data": jsonable_encoder(rows),
        }
    except HTTPException:
        raise
    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(status_code=400, detail=f"新增 SKU 失败：{error_message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"新增 SKU 失败：{str(e)}")


@app.patch("/admin/products/{product_id}/skus/{sku_id}")
def update_admin_product_sku(
    product_id: int,
    sku_id: int,
    req: AdminSkuUpdateRequest,
    authorization: str | None = Header(None),
):
    require_admin_user(authorization)
    sku_row = admin_sku_payload_to_row(req)

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id
                        FROM product_sku
                        WHERE id = %s
                          AND product_id = %s
                          AND is_deleted = 0
                        FOR UPDATE
                        """,
                        (sku_id, product_id)
                    )
                    if not cursor.fetchone():
                        raise HTTPException(status_code=404, detail="SKU 不存在、已删除或不属于该商品")

                    ensure_admin_sku_unique(cursor, product_id, sku_row, sku_id)
                    cursor.execute(
                        """
                        UPDATE product_sku
                        SET sku_code = %s,
                            sku_name = %s,
                            color_name = %s,
                            size_name = %s,
                            price = %s,
                            status = %s
                        WHERE id = %s AND product_id = %s AND is_deleted = 0
                        """,
                        (
                            sku_row["sku_code"],
                            sku_row["sku_name"],
                            sku_row["color"],
                            sku_row["size"],
                            sku_row["price"],
                            sku_row["status"],
                            sku_id,
                            product_id,
                        )
                    )
                    cursor.execute(
                        """
                        INSERT INTO inventory(sku_id, available_stock, locked_stock)
                        VALUES(%s, %s, 0)
                        ON DUPLICATE KEY UPDATE available_stock = VALUES(available_stock)
                        """,
                        (sku_id, sku_row["stock"])
                    )
                conn.commit()
                rows = query_admin_product_skus(conn, product_id)
            except HTTPException:
                conn.rollback()
                raise
            except Exception:
                conn.rollback()
                raise

        updated_row = next(row for row in rows if int(row["sku_id"]) == sku_id)
        return {
            "success": True,
            "message": "SKU 修改成功",
            "product_id": product_id,
            "sku_id": sku_id,
            "data": jsonable_encoder(updated_row),
        }
    except HTTPException:
        raise
    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(status_code=400, detail=f"修改 SKU 失败：{error_message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"修改 SKU 失败：{str(e)}")


@app.delete("/admin/products/{product_id}/skus/{sku_id}")
def delete_admin_product_sku(
    product_id: int,
    sku_id: int,
    authorization: str | None = Header(None),
):
    require_admin_user(authorization)
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id
                        FROM product_sku
                        WHERE product_id = %s AND is_deleted = 0
                        ORDER BY id
                        FOR UPDATE
                        """,
                        (product_id,)
                    )
                    active_sku_ids = [int(row["id"]) for row in cursor.fetchall()]
                    if sku_id not in active_sku_ids:
                        raise HTTPException(status_code=404, detail="SKU 不存在、已删除或不属于该商品")
                    if len(active_sku_ids) <= 1:
                        raise HTTPException(status_code=400, detail="不允许删除最后一个未删除 SKU")

                    cursor.execute(
                        """
                        UPDATE product_sku
                        SET is_deleted = 1,
                            status = 'OFF_SALE'
                        WHERE id = %s AND product_id = %s AND is_deleted = 0
                        """,
                        (sku_id, product_id)
                    )
                conn.commit()
                rows = query_admin_product_skus(conn, product_id)
            except HTTPException:
                conn.rollback()
                raise
            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "SKU 已逻辑删除",
            "product_id": product_id,
            "sku_id": sku_id,
            "data": jsonable_encoder(rows),
        }
    except HTTPException:
        raise
    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(status_code=400, detail=f"删除 SKU 失败：{error_message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除 SKU 失败：{str(e)}")


@app.get("/admin/inventory")
def get_admin_inventory(authorization: str | None = Header(None)):
    """
    后台库存列表。
    显示所有未逻辑删除的商品 SKU，包括上架和下架商品。
    """
    try:
        require_admin_user(authorization)

        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        category_id,
                        category_name,
                        product_id,
                        product_name,
                        description,
                        image_url,
                        product_status,
                        sku_id,
                        sku_code,
                        sku_name,
                        color_name,
                        size_name,
                        price,
                        sku_status,
                        sku_is_deleted,
                        available_stock,
                        locked_stock,
                        total_sold_count,
                        total_sales_amount,
                        product_created_at,
                        product_updated_at,
                        inventory_updated_at
                    FROM v_product_detail
                    ORDER BY product_id DESC, sku_id ASC
                    """
                )
                rows = cursor.fetchall()
                rows = serialize_sku_rows(rows)
                rows = attach_product_images(conn, rows)

        return {
            "success": True,
            "message": "查询后台库存列表成功",
            "count": len(rows),
            "data": jsonable_encoder(rows)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询后台库存列表失败：{str(e)}"
        )


@app.post("/admin/inventory/update-stock")
def update_admin_stock(req: AdminStockUpdateRequest, authorization: str | None = Header(None)):
    """
    后台修改 SKU 可用库存。
    注意：这里修改的是 available_stock，不直接修改 locked_stock。
    """
    require_admin_user(authorization)
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 纭 SKU 瀛樺湪涓旀湭琚€昏緫鍒犻櫎
                    cursor.execute(
                        """
                        SELECT id
                        FROM product_sku
                        WHERE id = %s
                          AND is_deleted = 0
                        """,
                        (req.sku_id,)
                    )
                    sku = cursor.fetchone()

                    if not sku:
                        raise HTTPException(
                            status_code=404,
                            detail="SKU 不存在或已删除"
                        )

                    # 2. 锁定库存行，避免并发修改
                    cursor.execute(
                        """
                        SELECT id, locked_stock
                        FROM inventory
                        WHERE sku_id = %s
                        FOR UPDATE
                        """,
                        (req.sku_id,)
                    )
                    inventory = cursor.fetchone()

                    # 3. 如果库存记录不存在，则新建；存在则更新
                    if inventory:
                        cursor.execute(
                            """
                            UPDATE inventory
                            SET available_stock = %s
                            WHERE sku_id = %s
                            """,
                            (req.available_stock, req.sku_id)
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO inventory(
                                sku_id,
                                available_stock,
                                locked_stock
                            )
                            VALUES(%s, %s, 0)
                            """,
                            (req.sku_id, req.available_stock)
                        )

                conn.commit()

                # 4. 杩斿洖淇敼鍚庣殑搴撳瓨璇︽儏
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            category_id,
                            category_name,
                            product_id,
                            product_name,
                            description,
                            image_url,
                            product_status,
                            sku_id,
                            sku_code,
                            sku_name,
                            color_name,
                            size_name,
                            price,
                            sku_status,
                            sku_is_deleted,
                            available_stock,
                            locked_stock,
                            total_sold_count,
                            total_sales_amount,
                            product_created_at,
                            product_updated_at,
                            inventory_updated_at
                        FROM v_product_detail
                        WHERE sku_id = %s
                        """,
                        (req.sku_id,)
                    )
                    row = cursor.fetchone()
                    serialize_sku_rows([row])
                    attach_product_images(conn, [row])

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "搴撳瓨淇敼鎴愬姛",
            "data": jsonable_encoder(row)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"库存修改失败：{str(e)}"
        )


@app.post("/admin/products/update-status")
def update_admin_product_status(req: AdminProductStatusUpdateRequest, authorization: str | None = Header(None)):
    """
    鍚庡彴淇敼鍟嗗搧涓婁笅鏋剁姸鎬併€?
    绗竴鐗堬細鍟嗗搧鍜岃鍟嗗搧涓嬪叏閮?SKU 鐘舵€佷繚鎸佷竴鑷淬€?
    """
    require_admin_user(authorization)

    new_status = req.status.strip().upper()

    if new_status not in {"ON_SALE", "OFF_SALE"}:
        raise HTTPException(
            status_code=400,
            detail="鍟嗗搧鐘舵€佸彧鑳芥槸 ON_SALE 鎴?OFF_SALE"
        )

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 纭鍟嗗搧瀛樺湪涓旀湭鍒犻櫎
                    cursor.execute(
                        """
                        SELECT id
                        FROM product
                        WHERE id = %s
                          AND is_deleted = 0
                        """,
                        (req.product_id,)
                    )
                    product = cursor.fetchone()

                    if not product:
                        raise HTTPException(
                            status_code=404,
                            detail="商品不存在或已删除"
                        )

                    # 2. 淇敼鍟嗗搧涓昏〃鐘舵€?
                    cursor.execute(
                        """
                        UPDATE product
                        SET status = %s
                        WHERE id = %s
                        """,
                        (new_status, req.product_id)
                    )

                    # 3. 绗竴鐗堝悓姝ヤ慨鏀硅鍟嗗搧涓嬮潰鍏ㄩ儴 SKU 鐘舵€?
                    cursor.execute(
                        """
                        UPDATE product_sku
                        SET status = %s
                        WHERE product_id = %s
                          AND is_deleted = 0
                        """,
                        (new_status, req.product_id)
                    )

                conn.commit()

                # 4. 杩斿洖淇敼鍚庣殑鍟嗗搧璇︽儏
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            category_id,
                            category_name,
                            product_id,
                            product_name,
                            description,
                            image_url,
                            product_status,
                            sku_id,
                            sku_code,
                            sku_name,
                            color_name,
                            size_name,
                            price,
                            sku_status,
                            sku_is_deleted,
                            available_stock,
                            locked_stock,
                            total_sold_count,
                            total_sales_amount,
                            product_created_at,
                            product_updated_at,
                            inventory_updated_at
                        FROM v_product_detail
                        WHERE product_id = %s
                        ORDER BY sku_id ASC
                        """,
                        (req.product_id,)
                    )
                    rows = cursor.fetchall()
                    rows = serialize_sku_rows(rows)
                    rows = attach_product_images(conn, rows)

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "商品状态修改成功",
            "product_id": req.product_id,
            "status": new_status,
            "data": jsonable_encoder(rows)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"鍟嗗搧鐘舵€佷慨鏀瑰け璐ワ細{str(e)}"
        )


@app.post("/admin/products/delete")
def delete_admin_product(req: AdminProductDeleteRequest, authorization: str | None = Header(None)):
    """
    鍚庡彴鍟嗗搧閫昏緫鍒犻櫎銆?    涓嶅垹闄ゅ簱涓殑璁板綍锛屼粎鏍囪 product銆乸roduct_sku 涓哄凡鍒犻櫎銆?    """
    try:
        require_admin_user(authorization)

        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id
                        FROM product
                        WHERE id = %s
                          AND is_deleted = 0
                        """,
                        (req.product_id,)
                    )
                    product = cursor.fetchone()

                    if not product:
                        raise HTTPException(
                            status_code=404,
                            detail="商品不存在或已删除"
                        )

                    cursor.execute(
                        """
                        UPDATE product
                        SET is_deleted = 1, status = 'OFF_SALE'
                        WHERE id = %s
                          AND is_deleted = 0
                        """,
                        (req.product_id,)
                    )

                    cursor.execute(
                        """
                        UPDATE product_sku
                        SET is_deleted = 1, status = 'OFF_SALE'
                        WHERE product_id = %s
                          AND is_deleted = 0
                        """,
                        (req.product_id,)
                    )

                conn.commit()

                return {
                    "success": True,
                    "message": "鍟嗗搧宸查€昏緫鍒犻櫎",
                    "product_id": req.product_id,
                }

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"商品删除失败：{str(e)}"
        )


@app.get("/orders/{order_id}")
def get_order_detail(order_id: int):
    """
    鏌ヨ璁㈠崟璇︽儏銆?
    浣跨敤 v_order_summary銆乿_user_order_detail锛屽苟琛ュ厖鏀粯璁板綍銆佺姸鎬佹棩蹇椼€佸簱瀛樻祦姘淬€?
    """
    try:
        with get_db() as conn:
            # 1. 鏌ヨ璁㈠崟姹囨€?
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        order_id,
                        order_no,
                        user_id,
                        email,
                        status,
                        total_amount,
                        item_kind_count,
                        total_quantity,
                        item_total_amount,
                        created_at,
                        updated_at
                    FROM v_order_summary
                    WHERE order_id = %s
                    """,
                    (order_id,)
                )
                order_summary = cursor.fetchone()

            if not order_summary:
                raise HTTPException(
                    status_code=404,
                    detail="订单不存在"
                )

            order_no = order_summary["order_no"]

            # 2. 鏌ヨ璁㈠崟鍟嗗搧鏄庣粏
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        user_id,
                        email,
                        order_id,
                        order_no,
                        order_status,
                        total_amount,
                        order_created_at,
                        order_updated_at,
                        recipient_name,
                        phone,
                        address_detail,
                        order_item_id,
                        product_id,
                        product_name,
                        sku_id,
                        sku_name,
                        quantity,
                        price,
                        item_amount,
                        pay_method,
                        pay_status,
                        pay_amount,
                        pay_created_at
                    FROM v_user_order_detail
                    WHERE order_id = %s
                    ORDER BY order_item_id
                    """,
                    (order_id,)
                )
                order_items = cursor.fetchall()

            # 3. 鏌ヨ鏀粯璁板綍
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        order_id,
                        pay_method,
                        pay_status,
                        pay_amount,
                        created_at
                    FROM payment_record
                    WHERE order_id = %s
                    ORDER BY id DESC
                    """,
                    (order_id,)
                )
                payment_records = cursor.fetchall()

            # 4. 鏌ヨ璁㈠崟鐘舵€佹棩蹇?
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        order_id,
                        from_status,
                        to_status,
                        remark,
                        created_at
                    FROM order_status_log
                    WHERE order_id = %s
                    ORDER BY id
                    """,
                    (order_id,)
                )
                status_logs = cursor.fetchall()

            # 5. 鏌ヨ搴撳瓨娴佹按
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        sku_id,
                        change_type,
                        change_qty,
                        ref_no,
                        created_at
                    FROM inventory_log
                    WHERE ref_no = %s
                    ORDER BY id
                    """,
                    (order_no,)
                )
                inventory_logs = cursor.fetchall()

        return {
            "success": True,
            "order_id": order_id,
            "order_summary": jsonable_encoder(order_summary),
            "order_items": jsonable_encoder(order_items),
            "payment_records": jsonable_encoder(payment_records),
            "status_logs": jsonable_encoder(status_logs),
            "inventory_logs": jsonable_encoder(inventory_logs)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询订单详情失败：{str(e)}"
        )

