import json
import logging
import re
import uuid
from datetime import date, datetime
from decimal import Decimal

from app.db import get_db


LOGGER = logging.getLogger(__name__)

ACTION_RESULTS = {"SUCCESS", "FAILURE"}
CURRENT_TARGET_TYPES = {
    "USER",
    "CATEGORY",
    "TAG",
    "PRODUCT",
    "SKU",
    "INVENTORY",
    "PRODUCT_IMAGE",
    "ORDER",
}
DETAIL_FIELD_WHITELIST = {
    "before",
    "after",
    "changed_fields",
    "count",
    "ids",
    "reason_summary",
    "image_count",
    "sku_count",
    "mode",
    "operation",
    "tag_ids",
    "product_ids",
    "changed_product_ids",
    "changed",
    "restored",
    "requested_product_count",
    "changed_product_count",
    "unchanged_product_count",
    "product_count",
    "tag_count",
}
SENSITIVE_KEY_PARTS = {
    "authorization",
    "credential",
    "databaseurl",
    "databasepassword",
    "filecontent",
    "imagecontent",
    "password",
    "passwordhash",
    "paypassword",
    "secret",
    "session",
    "token",
}
_UNSUPPORTED = object()


def create_operation_request_id(request_id: str | None = None) -> str:
    existing = str(request_id or "").strip()
    if existing:
        return existing[:64]
    return uuid.uuid4().hex


def truncate_operation_remark(remark: str | None, max_length: int = 255) -> str | None:
    text = str(remark or "").strip()
    if not text:
        return None
    if len(text) <= max_length:
        return text
    if max_length <= 1:
        return "…"[:max_length]
    return f"{text[:max_length - 1]}…"


def _normalized_key(key) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key or "").lower())


def _is_sensitive_key(key) -> bool:
    normalized = _normalized_key(key)
    return any(part in normalized for part in SENSITIVE_KEY_PARTS)


def _sanitize_detail_value(value, seen: set[int]):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    value_id = id(value)
    if value_id in seen:
        return _UNSUPPORTED

    if isinstance(value, dict):
        seen.add(value_id)
        sanitized = {}
        for key, nested_value in value.items():
            if _is_sensitive_key(key):
                continue
            clean_value = _sanitize_detail_value(nested_value, seen)
            if clean_value is not _UNSUPPORTED:
                sanitized[str(key)] = clean_value
        seen.remove(value_id)
        return sanitized if sanitized else _UNSUPPORTED

    if isinstance(value, (list, tuple)):
        seen.add(value_id)
        sanitized = []
        for nested_value in value:
            clean_value = _sanitize_detail_value(nested_value, seen)
            if clean_value is not _UNSUPPORTED:
                sanitized.append(clean_value)
        seen.remove(value_id)
        return sanitized

    return _UNSUPPORTED


def sanitize_operation_detail(detail: dict | None) -> dict | None:
    if not isinstance(detail, dict):
        return None

    sanitized = {}
    for key in DETAIL_FIELD_WHITELIST:
        if key not in detail or _is_sensitive_key(key):
            continue
        clean_value = _sanitize_detail_value(detail[key], set())
        if clean_value is not _UNSUPPORTED:
            sanitized[key] = clean_value
    return sanitized or None


def serialize_operation_detail(detail: dict | None) -> str | None:
    sanitized = sanitize_operation_detail(detail)
    if sanitized is None:
        return None
    try:
        return json.dumps(sanitized, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError, OverflowError):
        return None


def parse_operation_detail(value) -> dict | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def safe_failure_reason(error, fallback: str = "业务操作失败") -> str:
    detail = getattr(error, "detail", None)
    if isinstance(detail, str) and detail.strip():
        return truncate_operation_remark(detail, 160) or fallback
    return fallback


def insert_operation_log(
    cursor,
    operator_id: int,
    action_type: str,
    target_type: str | None,
    target_id: int | None,
    action_result: str,
    remark: str | None,
    detail: dict | None,
    request_id: str | None = None,
) -> str:
    normalized_action_type = str(action_type or "").strip().upper()
    normalized_target_type = str(target_type or "").strip().upper() or None
    normalized_action_result = str(action_result or "").strip().upper()

    if not normalized_action_type or len(normalized_action_type) > 64:
        raise ValueError("action_type 必须是 1 到 64 个字符")
    if normalized_target_type and not re.fullmatch(r"[A-Z][A-Z0-9_]{0,39}", normalized_target_type):
        raise ValueError("target_type 格式不正确")
    if normalized_action_result not in ACTION_RESULTS:
        raise ValueError("action_result 只能是 SUCCESS 或 FAILURE")

    normalized_request_id = create_operation_request_id(request_id)
    cursor.execute(
        """
        INSERT INTO operation_log(
            operator_id,
            action_type,
            target_type,
            target_id,
            action_result,
            remark,
            detail_json,
            request_id
        )
        VALUES(%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            int(operator_id),
            normalized_action_type,
            normalized_target_type,
            int(target_id) if target_id is not None else None,
            normalized_action_result,
            truncate_operation_remark(remark),
            serialize_operation_detail(detail),
            normalized_request_id,
        ),
    )
    return normalized_request_id


def write_failure_operation_log(
    operator_id: int,
    action_type: str,
    target_type: str | None,
    target_id: int | None,
    remark: str | None,
    detail: dict | None,
    request_id: str | None = None,
) -> bool:
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    insert_operation_log(
                        cursor=cursor,
                        operator_id=operator_id,
                        action_type=action_type,
                        target_type=target_type,
                        target_id=target_id,
                        action_result="FAILURE",
                        remark=remark,
                        detail=detail,
                        request_id=request_id,
                    )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
        return True
    except Exception as error:
        LOGGER.warning(
            "管理员失败操作日志写入失败 request_id=%s action_type=%s error=%s",
            create_operation_request_id(request_id),
            action_type,
            error,
        )
        return False
