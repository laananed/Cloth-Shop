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
    description="鏈嶈鍟嗗煄 / 杩涢攢瀛樼鐞嗙郴缁熷悗绔?API",
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
            detail="鍥剧墖鏍煎紡涓嶆敮鎸侊紝璇蜂笂浼?jpg銆乯peg銆乸ng銆亀ebp 鎴?gif 鏂囦欢"
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
        raise HTTPException(status_code=401, detail="绠＄悊鍛樼櫥褰曞凡澶辨晥锛岃閲嶆柊鐧诲綍")

    padding = "=" * (-len(token_text) % 4)

    try:
      decoded = base64.urlsafe_b64decode(f"{token_text}{padding}".encode("utf-8")).decode("utf-8")
    except Exception:
        raise HTTPException(status_code=401, detail="绠＄悊鍛樼櫥褰曞凡澶辨晥锛岃閲嶆柊鐧诲綍")

    parts = decoded.split(":")

    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="绠＄悊鍛樼櫥褰曞凡澶辨晥锛岃閲嶆柊鐧诲綍")

    admin_user_id_text, expires_at_text, signature = parts

    try:
        admin_user_id = int(admin_user_id_text)
        expires_at = int(expires_at_text)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="绠＄悊鍛樼櫥褰曞凡澶辨晥锛岃閲嶆柊鐧诲綍")

    if expires_at < int(time.time()):
        raise HTTPException(status_code=401, detail="绠＄悊鍛樼櫥褰曞凡澶辨晥锛岃閲嶆柊鐧诲綍")

    payload = f"{admin_user_id}:{expires_at}"
    expected_signature = hmac.new(ADMIN_TOKEN_SECRET, payload.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=401, detail="绠＄悊鍛樼櫥褰曞凡澶辨晥锛岃閲嶆柊鐧诲綍")

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
            detail=f"鏍￠獙绠＄悊鍛樿韩浠藉け璐ワ細{str(e)}"
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
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    sku_id: int = Field(..., gt=0, description="SKU ID")
    quantity: int = Field(..., gt=0, description="加入购物车数量")

class CartUpdateQuantityRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    cart_item_id: int = Field(..., gt=0, description="璐墿杞︽槑缁咺D")
    quantity: int = Field(..., gt=0, description="修改后的购物车商品数量")

class CartDeleteItemRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    cart_item_id: int = Field(..., gt=0, description="璐墿杞︽槑缁咺D")

class OrderFromCartRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    address_id: int = Field(..., gt=0, description="鏀惰揣鍦板潃ID")

class OrderFromSelectedCartRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    address_id: int = Field(..., gt=0, description="鏀惰揣鍦板潃ID")
    cart_item_ids: list[int] = Field(..., min_length=1, description="瑕佺粨绠楃殑璐墿杞︽槑缁咺D鍒楄〃")

class PayOrderRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    order_id: int = Field(..., gt=0, description="璁㈠崟ID")
    pay_method: str = Field(..., description="鏀粯鏂瑰紡锛欰LIPAY / WECHAT / COD")
    pay_password: str = Field(..., min_length=6, max_length=6, description="6位支付密码")

class AddressAddRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    recipient_name: str = Field(..., min_length=1, max_length=50, description="收货人")
    phone: str = Field(..., min_length=1, max_length=20, description="手机号")
    detail: str = Field(..., min_length=1, max_length=255, description="璇︾粏鍦板潃")
    is_default: bool = Field(False, description="鏄惁璁句负榛樿鍦板潃")

class AddressSetDefaultRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    address_id: int = Field(..., gt=0, description="鍦板潃ID")


class AddressDeleteRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    address_id: int = Field(..., gt=0, description="鍦板潃ID")

class DirectOrderRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    address_id: int = Field(..., gt=0, description="鏀惰揣鍦板潃ID")
    sku_id: int = Field(..., gt=0, description="SKU ID")
    quantity: int = Field(..., gt=0, description="璐拱鏁伴噺")

class CancelOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="璁㈠崟ID")
    remark: str = Field("鐢ㄦ埛鍙栨秷璁㈠崟", description="鍙栨秷鍘熷洜")


class RefundOrderRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="鐢ㄦ埛ID")
    order_id: int = Field(..., gt=0, description="璁㈠崟ID")
    remark: str = Field("用户申请退款", description="退款原因")

class ProductCreateRequest(BaseModel):
    category_name: str = Field(..., min_length=1, max_length=80, description="鍟嗗搧鍒嗙被鍚嶇О")
    product_name: str = Field(..., min_length=1, max_length=120, description="鍟嗗搧鍚嶇О")
    sku_name: str = Field("榛樿瑙勬牸", max_length=100, description="SKU 鍚嶇О锛岀涓€鐗堜竴涓晢鍝佸彧瀵瑰簲涓€涓?SKU")
    price: float = Field(..., gt=0, description="SKU 鍞环")
    available_stock: int = Field(..., ge=0, description="鍒濆鍙敤搴撳瓨")

class AdminStockUpdateRequest(BaseModel):
    sku_id: int = Field(..., gt=0, description="瑕佷慨鏀瑰簱瀛樼殑 SKU ID")
    available_stock: int = Field(..., ge=0, description="鏂扮殑鍙敤搴撳瓨鏁伴噺")


class AdminProductStatusUpdateRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="瑕佷慨鏀圭姸鎬佺殑鍟嗗搧 ID")
    status: str = Field(..., description="鍟嗗搧鐘舵€侊細ON_SALE 鎴?OFF_SALE")


class AdminProductDeleteRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="瑕侀€昏緫鍒犻櫎鐨勫晢鍝?ID")

class AdminLoginRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class AdminShipOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("管理员后台发货", description="发货备注")


class AdminUnshipOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("管理员后台取消发货", description="取消发货备注")


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
                        product_updated_at,
                        inventory_updated_at
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


def parse_product_skus(
    skus_json: str | None,
    sku_name: str,
    price: float,
    available_stock: int
):
    """
    瑙ｆ瀽鍚庡彴涓婃灦鍟嗗搧鏃朵紶鍏ョ殑 SKU 鍒楄〃銆?
    濡傛灉 skus_json 涓虹┖锛屽垯鍥為€€涓哄崟 SKU銆?
    """
    if not skus_json or not skus_json.strip():
        return [
            {
                "sku_name": (sku_name or "榛樿瑙勬牸").strip() or "榛樿瑙勬牸",
                "price": float(price),
                "available_stock": int(available_stock),
            }
        ]

    try:
        sku_rows = json.loads(skus_json)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="澶?SKU 鏁版嵁鏍煎紡閿欒锛屽繀椤绘槸 JSON 鏁扮粍"
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
                detail=f"绗?{index} 鏉?SKU 鏍煎紡閿欒"
            )

        current_name = str(row.get("sku_name") or "").strip()
        current_price = row.get("price")
        current_stock = row.get("available_stock")

        if not current_name:
            raise HTTPException(
                status_code=400,
                detail=f"绗?{index} 鏉?SKU 鍚嶇О涓嶈兘涓虹┖"
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
                detail=f"第 {index} 行 SKU 价格不正确"
            )

        try:
            current_stock = int(current_stock)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"第 {index} 行 SKU 库存不正确"
            )

        if current_price <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"绗?{index} 鏉?SKU 浠锋牸蹇呴』澶т簬 0"
            )

        if current_stock < 0:
            raise HTTPException(
                status_code=400,
                detail=f"绗?{index} 鏉?SKU 搴撳瓨涓嶈兘灏忎簬 0"
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
    sku_name: str = Form("榛樿瑙勬牸"),
    price: float = Form(...),
    available_stock: int = Form(...),
    skus_json: str | None = Form(None),
    image: UploadFile | None = File(None),
    authorization: str | None = Header(None),
):
    """
    鍚庡彴鏂板鍟嗗搧銆?
    绗竴鐗堬細涓€涓晢鍝佸彧鍒涘缓涓€涓?SKU銆?
    鏀寔涓婁紶涓€寮犲晢鍝佷富鍥撅紝鍥剧墖淇濆瓨鍒?uploads/products锛岃矾寰勫啓鍏?product.image_url銆?
    """
    require_admin_user(authorization)

    category_name = category_name.strip()
    product_name = product_name.strip()
    sku_name = sku_name.strip() or "榛樿瑙勬牸"

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

    image_url = None

    if image and image.filename:
        image_filename = build_product_image_filename(image.filename)
        image_path = PRODUCT_UPLOAD_DIR / image_filename

        content = await image.read()

        if not content:
            raise HTTPException(status_code=400, detail="上传的图片文件为空")

        max_size = 8 * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="鍥剧墖涓嶈兘瓒呰繃 8MB")

        image_path.write_bytes(content)
        image_url = f"/uploads/products/{image_filename}"

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
                            image_url,
                            status,
                            is_deleted
                        )
                        VALUES(%s, %s, %s, 'ON_SALE', 0)
                        """,
                        (category_id, product_name, image_url)
                    )
                    product_id = cursor.lastrowid

                    # 3. 鍐欏叆 product_sku 琛?
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

                # 6. 鏂板鎴愬姛鍚庯紝浠?v_product_detail 鏌ュ洖瀹屾暣鍟嗗搧淇℃伅
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
                            product_updated_at,
                            inventory_updated_at
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
            "message": "鏂板鍟嗗搧鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            "message": "鏌ヨ鐢ㄦ埛鍦板潃鎴愬姛",
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
    鏂板鐢ㄦ埛鏀惰揣鍦板潃銆?
    褰撳墠鏁版嵁搴?user_address 琛ㄥ彧鏈?detail 瀛楁锛屾墍浠ュ墠绔細鎶婄渷甯傚尯鍜岃缁嗗湴鍧€鍚堝苟鍚庝紶鍏?detail銆?
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
            "message": "鏂板鏀惰揣鍦板潃鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            "message": "璁剧疆榛樿鍦板潃鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            "message": "鍒犻櫎鏀惰揣鍦板潃鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            detail=f"鏌ヨ璐墿杞﹀け璐ワ細{str(e)}"
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

                # 鍔犲叆鎴愬姛鍚庯紝鍐嶆煡璇竴娆＄敤鎴疯喘鐗╄溅锛屾柟渚垮墠绔洿鎺ュ埛鏂伴〉闈?
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
        # MySQL 瀛樺偍杩囩▼ SIGNAL 鎶涘嚭鐨勯敊璇紝閫氬父鍦?e.args[1]
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"鍔犲叆璐墿杞﹀け璐ワ細{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            detail=f"淇敼璐墿杞︽暟閲忓け璐ワ細{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            detail=f"鍒犻櫎璐墿杞﹀晢鍝佸け璐ワ細{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            "message": "浠庤喘鐗╄溅鍒涘缓璁㈠崟鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
        )

@app.post("/orders/from-cart-selected")
def create_order_from_selected_cart(req: OrderFromSelectedCartRequest):
    """
    浠庤喘鐗╄溅涓€変腑鐨勫晢鍝佸垱寤鸿鍗曘€?
    璋冪敤鏂板瀛樺偍杩囩▼ sp_create_order_from_selected_cart_items銆?
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
            "message": "浠庤喘鐗╄溅閫変腑鍟嗗搧鍒涘缓璁㈠崟鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
                            detail="鏀粯瀵嗙爜閿欒"
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
            "message": "璁㈠崟鏀粯鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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

                # 6. 鏌ヨ搴撳瓨娴佹按锛岃瘉鏄庡簱瀛樺凡缁忚閿佸畾
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
            "message": "鐩存帴涓嬪崟鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            "message": "璁㈠崟鍙栨秷鎴愬姛",
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
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
        )

@app.post("/orders/refund")
def refund_order(req: RefundOrderRequest):
    """
    閫€娆捐鍗曘€?    璋冪敤宸插瓨鍦ㄥ瓨鍌ㄨ繃绋?sp_refund_paid_order銆?    """
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
            detail=f"璁㈠崟閫€娆惧け璐ワ細{error_message}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"鏈嶅姟鍣ㄩ敊璇細{str(e)}"
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
            "message": "鏌ヨ鍚庡彴璁㈠崟鍒楄〃鎴愬姛",
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
    鍚庡彴璁㈠崟璇︽儏銆?    """
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
    鍚庡彴閿€閲忕粺璁°€?    绗竴鐗堟殏涓嶅仛鏉冮檺鏍￠獙锛岀粺璁＄湡瀹炴暟鎹簱璁㈠崟銆佸晢鍝併€侀攢閲忔帓琛屻€?    """
    try:
        require_admin_user(authorization)

        with get_db() as conn:
            with conn.cursor() as cursor:
                # 1. 璁㈠崟涓庨攢鍞姹囨€?
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS total_order_count,
                        SUM(CASE WHEN status IN ('PAID', 'SHIPPED', 'COMPLETED') THEN 1 ELSE 0 END) AS paid_order_count,
                        SUM(CASE WHEN status = 'PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending_order_count,
                        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_order_count,
                        COALESCE(SUM(CASE WHEN status IN ('PAID', 'SHIPPED', 'COMPLETED') THEN total_amount ELSE 0 END), 0.00) AS total_revenue,
                        COALESCE(SUM(CASE WHEN status IN ('PAID', 'SHIPPED', 'COMPLETED') THEN total_quantity ELSE 0 END), 0) AS total_units_sold
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

                # 3. 鍟嗗搧閿€閲忔帓琛?
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
            detail=f"鏌ヨ鍚庡彴閿€閲忕粺璁″け璐ワ細{str(e)}"
        )

@app.get("/admin/inventory")
def get_admin_inventory(authorization: str | None = Header(None)):
    """
    鍚庡彴搴撳瓨鍒楄〃銆?    鏄剧ず鎵€鏈夋湭閫昏緫鍒犻櫎鐨勫晢鍝?SKU锛屽寘鎷笂鏋跺拰涓嬫灦鍟嗗搧銆?    """
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
                        product_updated_at,
                        inventory_updated_at
                    FROM v_product_detail
                    ORDER BY product_id DESC, sku_id ASC
                    """
                )
                rows = cursor.fetchall()

        return {
            "success": True,
            "message": "鏌ヨ鍚庡彴搴撳瓨鍒楄〃鎴愬姛",
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
    鍚庡彴淇敼 SKU 鍙敤搴撳瓨銆?
    娉ㄦ剰锛氳繖閲屼慨鏀圭殑鏄?available_stock锛屼笉鐩存帴淇敼 locked_stock銆?
    """
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

                    # 2. 閿佸畾搴撳瓨琛岋紝閬垮厤骞跺彂淇敼
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

                    # 3. 濡傛灉搴撳瓨璁板綍涓嶅瓨鍦紝鍒欐柊寤猴紱瀛樺湪鍒欐洿鏂?
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
                            product_updated_at,
                            inventory_updated_at
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
                            product_updated_at,
                            inventory_updated_at
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

