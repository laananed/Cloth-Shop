import os
from contextlib import contextmanager

import pymysql
from dotenv import load_dotenv
from pymysql.cursors import DictCursor

load_dotenv()


def get_connection():
    """
    创建一个 MySQL 连接。
    cursorclass=DictCursor 的作用：
    查询结果返回字典，而不是元组，方便 FastAPI 转成 JSON。
    """
    return pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "frieren_cloth_shop_db"),
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )


@contextmanager
def get_db():
    """
    数据库连接上下文管理器。
    用法：
        with get_db() as conn:
            ...
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def test_connection():
    """
    测试数据库是否能连接成功。
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT DATABASE() AS db_name, VERSION() AS mysql_version")
            return cursor.fetchone()