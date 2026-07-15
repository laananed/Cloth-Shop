-- 阶段 16：管理员运行时操作日志增量迁移
-- 前置条件：已执行 01～08；09 由并行商品标签工作线保留。
-- 影响对象：仅扩展 operation_log，不删除、不重建、不改写历史日志。
-- 幂等性：通过 information_schema 判断字段和索引，可连续重复执行。
-- 恢复建议：执行前备份表结构；本迁移只做兼容新增，通常无需回滚。

USE frieren_cloth_shop_db;

DROP PROCEDURE IF EXISTS migrate_admin_operation_log_v10;

DELIMITER $$

CREATE PROCEDURE migrate_admin_operation_log_v10()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND column_name = 'target_type'
    ) THEN
        ALTER TABLE operation_log
            ADD COLUMN target_type VARCHAR(40) NULL AFTER action_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND column_name = 'target_id'
    ) THEN
        ALTER TABLE operation_log
            ADD COLUMN target_id BIGINT NULL AFTER target_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND column_name = 'action_result'
    ) THEN
        ALTER TABLE operation_log
            ADD COLUMN action_result VARCHAR(16) NOT NULL DEFAULT 'SUCCESS' AFTER target_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND column_name = 'detail_json'
    ) THEN
        ALTER TABLE operation_log
            ADD COLUMN detail_json JSON NULL AFTER remark;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND column_name = 'request_id'
    ) THEN
        ALTER TABLE operation_log
            ADD COLUMN request_id VARCHAR(64) NULL AFTER detail_json;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND index_name = 'idx_operation_log_action_created'
    ) THEN
        ALTER TABLE operation_log
            ADD INDEX idx_operation_log_action_created (action_type, created_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND index_name = 'idx_operation_log_target_created'
    ) THEN
        ALTER TABLE operation_log
            ADD INDEX idx_operation_log_target_created (target_type, target_id, created_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'operation_log'
          AND index_name = 'idx_operation_log_result_created'
    ) THEN
        ALTER TABLE operation_log
            ADD INDEX idx_operation_log_result_created (action_result, created_at);
    END IF;
END$$

DELIMITER ;

CALL migrate_admin_operation_log_v10();
DROP PROCEDURE IF EXISTS migrate_admin_operation_log_v10;

SELECT
    column_name,
    column_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'operation_log'
ORDER BY ordinal_position;

SELECT
    index_name,
    GROUP_CONCAT(column_name ORDER BY seq_in_index) AS index_columns
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'operation_log'
GROUP BY index_name
ORDER BY index_name;
