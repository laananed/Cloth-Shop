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
        "http://127.0.0.1:5500",
        "http://localhost:5500",
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


def build_product_image_filename(original_filename: str) -> str:
    suffix = Path(original_filename or "").suffix.lower()

    if suffix not in ALLOWED_IMAGE_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail="图片格式不支持，请上传 jpg、jpeg、png、webp 或 gif 文件"
        )

    import uuid
    return f"{uuid.uuid4().hex}{suffix}"


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
    price: float = Field(..., gt=0, description="SKU 售价")
    available_stock: int = Field(..., ge=0, description="初始可用库存")

class AdminStockUpdateRequest(BaseModel):
    sku_id: int = Field(..., gt=0, description="要修改库存的 SKU ID")
    available_stock: int = Field(..., ge=0, description="新的可用库存数量")


class AdminProductStatusUpdateRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="要修改状态的商品 ID")
    status: str = Field(..., description="商品状态：ON_SALE 或 OFF_SALE")


class AdminProductDeleteRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="要逻辑删除的商品 ID")

class AdminLoginRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


@app.get("/")
def root():
    return {
        "message": "Frieren Cloth Shop API is running"
    }


@app.get("/db-test")
def db_test():
    """
    测试 FastAPI 是否能成功连接 MySQL。
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
            detail=f"数据库连接失败：{str(e)}"
        )


@app.get("/products")
def get_products():
    """
    查询商品列表。
    优先使用已有视图 v_product_detail。
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
                        product_id,
                        product_name,
                        image_url,
                        product_status,
                        sku_id,
                        sku_name,
                        price,
                        sku_status,
                        available_stock,
                        locked_stock,
                        total_sold_count,
                        total_sales_amount,
                        product_created_at,
                        product_updated_at
                    FROM v_product_detail
                    ORDER BY product_id, sku_id
                """
                cursor.execute(sql)
                rows = cursor.fetchall()

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
    管理员登录。
    """
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
            detail=f"管理员登录失败：{str(e)}"
        )


def parse_product_skus(
    skus_json: str | None,
    sku_name: str,
    price: float,
    available_stock: int
):
    """
    解析后台上架商品时传入的 SKU 列表。
    如果 skus_json 为空，则回退为单 SKU。
    """
    if not skus_json or not skus_json.strip():
        return [
            {
                "sku_name": (sku_name or "默认规格").strip() or "默认规格",
                "price": float(price),
                "available_stock": int(available_stock),
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

    parsed_rows = []
    seen_names = set()

    for index, row in enumerate(sku_rows, start=1):
        if not isinstance(row, dict):
            raise HTTPException(
                status_code=400,
                detail=f"第 {index} 条 SKU 格式错误"
            )

        current_name = str(row.get("sku_name") or "").strip()
        current_price = row.get("price")
        current_stock = row.get("available_stock")

        if not current_name:
            raise HTTPException(
                status_code=400,
                detail=f"第 {index} 条 SKU 名称不能为空"
            )

        if current_name in seen_names:
            raise HTTPException(
                status_code=400,
                detail=f"SKU 名称重复：{current_name}"
            )

        try:
            current_price = float(current_price)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"第 {index} 条 SKU 价格不正确"
            )

        try:
            current_stock = int(current_stock)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"第 {index} 条 SKU 库存不正确"
            )

        if current_price <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"第 {index} 条 SKU 价格必须大于 0"
            )

        if current_stock < 0:
            raise HTTPException(
                status_code=400,
                detail=f"第 {index} 条 SKU 库存不能小于 0"
            )

        seen_names.add(current_name)

        parsed_rows.append(
            {
                "sku_name": current_name,
                "price": current_price,
                "available_stock": current_stock,
            }
        )

    return parsed_rows

@app.post("/products")
async def create_product(
    category_name: str = Form(...),
    product_name: str = Form(...),
    sku_name: str = Form("默认规格"),
    price: float = Form(...),
    available_stock: int = Form(...),
    skus_json: str | None = Form(None),
    image: UploadFile | None = File(None),
    authorization: str | None = Header(None),
):
    """
    后台新增商品。
    第一版：一个商品只创建一个 SKU。
    支持上传一张商品主图，图片保存到 uploads/products，路径写入 product.image_url。
    """
    require_admin_user(authorization)

    category_name = category_name.strip()
    product_name = product_name.strip()
    sku_name = sku_name.strip() or "默认规格"

    if not category_name:
        raise HTTPException(status_code=400, detail="商品分类不能为空")

    if not product_name:
        raise HTTPException(status_code=400, detail="商品名称不能为空")

    if price <= 0:
        raise HTTPException(status_code=400, detail="商品价格必须大于 0")

    if available_stock < 0:
        raise HTTPException(status_code=400, detail="初始库存不能小于 0")
    sku_rows = parse_product_skus(
        skus_json=skus_json,
        sku_name=sku_name,
        price=price,
        available_stock=available_stock
    )

    image_url = None

    if image and image.filename:
        image_filename = build_product_image_filename(image.filename)
        image_path = PRODUCT_UPLOAD_DIR / image_filename

        content = await image.read()

        if not content:
            raise HTTPException(status_code=400, detail="上传的图片文件为空")

        max_size = 8 * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="图片不能超过 8MB")

        image_path.write_bytes(content)
        image_url = f"/uploads/products/{image_filename}"

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 分类不存在则创建，已存在则复用
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

                    # 2. 写入 product 表，保存 image_url
                    cursor.execute(
                        """
                        INSERT INTO product(
                            category_id,
                            name,
                            image_url,
                            status,
                            is_deleted
                        )
                        VALUES(%s, %s, %s, 'ON_SALE', 0)
                        """,
                        (category_id, product_name, image_url)
                    )
                    product_id = cursor.lastrowid

                    # 3. 写入 product_sku 表
                    sku_ids = []

                    for sku_row in sku_rows:
                        cursor.execute(
                            """
                            INSERT INTO product_sku(
                                product_id,
                                sku_name,
                                price,
                                status,
                                is_deleted
                            )
                            VALUES(%s, %s, %s, 'ON_SALE', 0)
                            """,
                            (
                                product_id,
                                sku_row["sku_name"],
                                sku_row["price"],
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
                                sku_row["available_stock"],
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

                # 6. 新增成功后，从 v_product_detail 查回完整商品信息
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            category_id,
                            category_name,
                            product_id,
                            product_name,
                            image_url,
                            product_status,
                            sku_id,
                            sku_name,
                            price,
                            sku_status,
                            available_stock,
                            locked_stock,
                            total_sold_count,
                            total_sales_amount,
                            product_created_at,
                            product_updated_at
                        FROM v_product_detail
                        WHERE product_id = %s
                        ORDER BY sku_id
                        """,
                        (product_id,)
                    )
                    rows = cursor.fetchall()

            except Exception:
                conn.rollback()
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
        raise

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"新增商品失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )


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


@app.get("/addresses/user/{user_id}")
def get_user_addresses(user_id: int):
    """
    查询用户收货地址列表。
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
            detail=f"服务器错误：{str(e)}"
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
    设置默认收货地址。
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
    删除收货地址。
    当前采用软删除：is_deleted = 1。
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
    查询指定用户的购物车。
    优先使用已有视图 v_user_cart_detail。
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
    加入购物车。
    调用已有存储过程 sp_add_to_cart。
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

    except MySQLError as e:
        # MySQL 存储过程 SIGNAL 抛出的错误，通常在 e.args[1]
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
    修改购物车商品数量。
    调用存储过程 sp_update_cart_item_quantity。
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
    删除购物车中的单个商品。
    调用存储过程 sp_delete_cart_item。
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
    从购物车创建订单。
    调用已有存储过程 sp_create_order_from_cart。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 调用存储过程，使用 MySQL 用户变量接收 OUT 参数
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

                    # 2. 清理可能存在的结果集，避免后续 SELECT 出错
                    while cursor.nextset():
                        pass

                    # 3. 读取存储过程 OUT 参数
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

                # 4. 查询订单汇总信息
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

                # 5. 查询订单明细信息
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
    调用新增存储过程 sp_create_order_from_selected_cart_items。
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
    支付订单。
    先校验用户、订单归属和支付密码，校验通过后调用 sp_pay_order。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 校验支付密码
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

                    # 2. 校验订单是否属于当前用户
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

                    # 3. 调用原有支付存储过程
                    cursor.execute(
                        "CALL sp_pay_order(%s, %s)",
                        (req.order_id, req.pay_method)
                    )

                    while cursor.nextset():
                        pass

                conn.commit()

                # 4. 查询支付后的订单概要
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
    直接下单 / 立即购买。
    调用已有存储过程 sp_create_direct_order。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 调用直接下单存储过程，用 MySQL 用户变量接收 OUT 参数
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

                    # 2. 清理可能存在的结果集
                    while cursor.nextset():
                        pass

                    # 3. 读取 OUT 参数
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

                # 4. 查询订单汇总
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

                # 5. 查询订单明细
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

                # 6. 查询库存流水，证明库存已经被锁定
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
    取消订单。
    调用已有存储过程 sp_cancel_order。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 调用取消订单存储过程
                    cursor.execute(
                        "CALL sp_cancel_order(%s, %s)",
                        (req.order_id, req.remark)
                    )

                    # 2. 清理可能存在的结果集
                    while cursor.nextset():
                        pass

                conn.commit()

                # 3. 查询订单汇总
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

                # 4. 查询订单状态日志
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

                # 5. 根据订单号查询库存流水
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
    退款订单。
    调用已存在存储过程 sp_refund_paid_order。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "CALL sp_refund_paid_order(%s, %s, %s)",
                        (req.user_id, req.order_id, req.remark)
                    )

                    while cursor.nextset():
                        pass

                conn.commit()

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
            "message": "订单退款成功",
            "order_id": req.order_id,
            "order_summary": jsonable_encoder(order_summary),
            "payment_records": jsonable_encoder(payment_records),
            "status_logs": jsonable_encoder(status_logs),
            "inventory_logs": jsonable_encoder(inventory_logs)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"订单退款失败：{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"服务器错误：{str(e)}"
        )


@app.get("/orders/user/{user_id}")
def get_user_orders(user_id: int):
    """
    查询某个用户的订单列表。
    使用已有视图 v_order_summary。
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
    后台订单列表。
    第一版暂不做权限校验，直接查询全部订单汇总。
    """
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
                # 1. 订单与销售额汇总
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS total_order_count,
                        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_order_count,
                        SUM(CASE WHEN status = 'PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending_order_count,
                        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_order_count,
                        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0.00) AS total_revenue,
                        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_quantity ELSE 0 END), 0) AS total_units_sold
                    FROM v_order_summary
                    """
                )
                summary = cursor.fetchone()

                # 2. 商品总数
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
                        image_url,
                        product_status,
                        sku_id,
                        sku_name,
                        price,
                        sku_status,
                        available_stock,
                        locked_stock,
                        total_sold_count,
                        total_sales_amount,
                        product_created_at,
                        product_updated_at
                    FROM v_product_detail
                    ORDER BY product_id DESC, sku_id ASC
                    """
                )
                rows = cursor.fetchall()

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
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 确认 SKU 存在且未被逻辑删除
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

                # 4. 返回修改后的库存详情
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            category_id,
                            category_name,
                            product_id,
                            product_name,
                            image_url,
                            product_status,
                            sku_id,
                            sku_name,
                            price,
                            sku_status,
                            available_stock,
                            locked_stock,
                            total_sold_count,
                            total_sales_amount,
                            product_created_at,
                            product_updated_at
                        FROM v_product_detail
                        WHERE sku_id = %s
                        """,
                        (req.sku_id,)
                    )
                    row = cursor.fetchone()

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "库存修改成功",
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
    后台修改商品上下架状态。
    第一版：商品和该商品下全部 SKU 状态保持一致。
    """
    require_admin_user(authorization)

    new_status = req.status.strip().upper()

    if new_status not in {"ON_SALE", "OFF_SALE"}:
        raise HTTPException(
            status_code=400,
            detail="商品状态只能是 ON_SALE 或 OFF_SALE"
        )

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 确认商品存在且未删除
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

                    # 2. 修改商品主表状态
                    cursor.execute(
                        """
                        UPDATE product
                        SET status = %s
                        WHERE id = %s
                        """,
                        (new_status, req.product_id)
                    )

                    # 3. 第一版同步修改该商品下面全部 SKU 状态
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

                # 4. 返回修改后的商品详情
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            category_id,
                            category_name,
                            product_id,
                            product_name,
                            image_url,
                            product_status,
                            sku_id,
                            sku_name,
                            price,
                            sku_status,
                            available_stock,
                            locked_stock,
                            total_sold_count,
                            total_sales_amount,
                            product_created_at,
                            product_updated_at
                        FROM v_product_detail
                        WHERE product_id = %s
                        ORDER BY sku_id ASC
                        """,
                        (req.product_id,)
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
            detail=f"商品状态修改失败：{str(e)}"
        )


@app.post("/admin/products/delete")
def delete_admin_product(req: AdminProductDeleteRequest, authorization: str | None = Header(None)):
    """
    后台商品逻辑删除。
    不删除库中的记录，仅标记 product、product_sku 为已删除。
    """
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
                    "message": "商品已逻辑删除",
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
            detail=f"商品逻辑删除失败：{str(e)}"
        )


@app.get("/orders/{order_id}")
def get_order_detail(order_id: int):
    """
    查询订单详情。
    使用 v_order_summary、v_user_order_detail，并补充支付记录、状态日志、库存流水。
    """
    try:
        with get_db() as conn:
            # 1. 查询订单汇总
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

            # 2. 查询订单商品明细
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

            # 3. 查询支付记录
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

            # 4. 查询订单状态日志
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

            # 5. 查询库存流水
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
