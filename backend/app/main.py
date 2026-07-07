from fastapi import FastAPI, HTTPException
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

class CartAddRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    sku_id: int = Field(..., gt=0, description="SKU ID")
    quantity: int = Field(..., gt=0, description="加入购物车数量")

class OrderFromCartRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    address_id: int = Field(..., gt=0, description="收货地址ID")

class PayOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    pay_method: str = Field("ALIPAY", description="支付方式，例如 ALIPAY / WECHAT")

class DirectOrderRequest(BaseModel):
    user_id: int = Field(..., gt=0, description="用户ID")
    address_id: int = Field(..., gt=0, description="收货地址ID")
    sku_id: int = Field(..., gt=0, description="SKU ID")
    quantity: int = Field(..., gt=0, description="购买数量")

class CancelOrderRequest(BaseModel):
    order_id: int = Field(..., gt=0, description="订单ID")
    remark: str = Field("用户取消订单", description="取消原因")

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

@app.get("/cart/{user_id}")
def get_cart(user_id: int):
    """
    查询指定用户的购物车。
    优先使用已有视图 v_user_cart_detail。
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                sql = """
                    SELECT
                        user_id,
                        email,
                        cart_id,
                        cart_item_id,
                        product_id,
                        product_name,
                        sku_id,
                        sku_name,
                        price,
                        quantity,
                        item_amount,
                        available_stock,
                        cart_status,
                        created_at,
                        updated_at
                    FROM v_user_cart_detail
                    WHERE user_id = %s
                    ORDER BY cart_item_id
                """
                cursor.execute(sql, (user_id,))
                rows = cursor.fetchall()

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
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            user_id,
                            email,
                            cart_id,
                            cart_item_id,
                            product_id,
                            product_name,
                            sku_id,
                            sku_name,
                            price,
                            quantity,
                            item_amount,
                            available_stock,
                            cart_status,
                            created_at,
                            updated_at
                        FROM v_user_cart_detail
                        WHERE user_id = %s
                        ORDER BY cart_item_id
                        """,
                        (req.user_id,)
                    )
                    rows = cursor.fetchall()

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


@app.post("/orders/pay")
def pay_order(req: PayOrderRequest):
    """
    支付订单。
    调用已有存储过程 sp_pay_order。
    """
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    # 1. 调用支付订单存储过程
                    cursor.execute(
                        "CALL sp_pay_order(%s, %s)",
                        (req.order_id, req.pay_method)
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

                # 4. 查询支付记录
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

                # 5. 查询订单状态日志
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

            except Exception:
                conn.rollback()
                raise

        return {
            "success": True,
            "message": "订单支付成功",
            "order_id": req.order_id,
            "order_summary": jsonable_encoder(order_summary),
            "payment_records": jsonable_encoder(payment_records),
            "status_logs": jsonable_encoder(status_logs)
        }

    except MySQLError as e:
        error_message = e.args[1] if len(e.args) > 1 else str(e)
        raise HTTPException(
            status_code=400,
            detail=f"支付订单失败：{error_message}"
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