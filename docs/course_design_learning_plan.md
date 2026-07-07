# 小型购物网站数据库课程设计学习计划

## 1. 当前项目现状分析

### 1.1 项目技术栈

- 当前仓库是一个纯前端静态项目，技术栈以 `HTML + CSS + 原生 JavaScript ES Module` 为主。
- `package.json` 只有 Node 自带测试脚本，没有后端运行脚本、数据库依赖、ORM 依赖或 API 框架依赖。
- 现有测试使用 `node --test`，说明当前测试目标主要是前端数据函数和页面结构，不是接口和数据库。
- 仓库里没有 `requirements.txt`、`pyproject.toml`、`server.py`、`app.py`、`main.py`、`Dockerfile`、`.env.example` 这类后端工程文件。

### 1.2 目录结构

```text
Cloth_Shop/
  index.html
  admin.html
  package.json
  src/
    main.js
    content.js
    account-store.js
    account-state.js
    ranking.js
    sidebar-ui.js
    styles.css
  tests/
    site.test.js
  assets/
    hero-background.png
    products/
    source-products/
```

### 1.3 现有业务模块

- 前台首页：商品展示、分类切换、购买弹窗、收藏夹、购物车、个人中心。
- 用户交互：登录/注册弹窗、地址簿维护。
- 订单表现层：购买后可在“购买记录”中查看本地生成的订单。
- 后台页面：订单查看、新品上架、销量统计。
- 销量排行：基于前端静态商品销量字段计算。

### 1.4 当前“数据层”真实情况

- 当前没有数据库。
- 当前没有后端 API。
- 当前没有真实用户认证。
- 当前没有真实库存扣减。
- 当前没有真实订单事务。
- 当前所有状态基本存放在浏览器 `localStorage` 中。

### 1.5 关键代码证据

- `src/main.js` 使用 `window.localStorage` 作为状态存储入口。
- `src/account-store.js` 负责本地订单、购物车、收藏夹、地址簿、后台商品、后台 mock 订单的读写。
- `buildPurchaseOrder()` 只是前端组装订单对象，不涉及数据库事务、库存锁、支付回写。
- `getStoredMockOrders()`、`getSalesSummary()`、`getProductSalesRows()` 都是基于本地 mock 数据做统计。
- `index.html` 与 `admin.html` 已经具备用户页和后台页的界面壳。

### 1.6 测试现状

- 已运行 `node --test tests/site.test.js`。
- 当前共 `44` 个测试，全部通过。
- 这些测试主要覆盖：
  - 商品内容与页面结构
  - 本地存储读写
  - 购物车数量汇总
  - 本地订单生成
  - 后台 mock 统计

### 1.7 当前项目已经具备哪些课程设计可用内容

- 有一个可演示的购物网站前端界面。
- 有明确的业务页面入口：商品、购物车、地址、订单、后台统计。
- 有较清晰的“将来可替换为真实后端”的交互壳。
- 有本地 mock 数据结构，可作为数据库建模的初始业务草稿。
- 有基础测试习惯，便于后续扩展 API 测试和 SQL 测试。

### 1.8 当前项目缺少哪些数据库课程设计必须内容

- 缺少需求分析文档、数据流图、数据字典。
- 缺少 ER 图、逻辑表结构、主外键、唯一约束设计。
- 缺少 MySQL 数据库与初始化 SQL。
- 缺少视图、触发器、存储过程、函数。
- 缺少事务控制、`SELECT ... FOR UPDATE`、异常回滚。
- 缺少库存模型与库存流水。
- 缺少真实订单状态流转。
- 缺少 EXPLAIN 与索引验证记录。
- 缺少数据库运维变更案例。
- 缺少 AI 使用记录、人工审核记录、工作日志。

### 1.9 哪些部分适合保留，哪些部分需要重构

适合保留：

- `index.html` 和 `admin.html` 的页面壳。
- 商品展示、购物车、地址簿、订单列表、后台统计的交互入口。
- `content.js` 中的商品种子数据，可转化为初始化数据。
- 已有测试文件中的业务断言思路。

建议重构：

- `src/main.js` 体量过大，前后端改造时不适合继续堆逻辑。
- `localStorage` 状态应逐步替换为数据库 + API。
- `account-store.js` 的“数据持久化职责”未来应迁移到 Python 服务层和数据库层。
- `account-state.js` 与 `account-store.js` 有重复校验函数，后续应统一。
- 后台统计目前基于 mock 数据聚合，后续应改为 SQL/存储过程输出。

### 1.10 当前项目是否适合作为数据库课程设计主体

结论：**适合，但只能作为“前端壳 + 业务原型基础”，不适合作为现成的数据库课程设计主体直接提交。**

原因：

- 优点是页面现成、业务场景直观、演示效果好。
- 不足是数据库系统核心内容几乎为空。
- 最合理的路线不是推倒重来，而是“保留前端展示壳，重建数据库后端与文档体系”。

## 2. 课程设计可行性判断

### 2.1 与任务书的匹配结论

你的题目“小型购物网站数据库管理系统的设计与实现”属于允许自拟题目，且难度适中，业务容易理解，适合两周内完成。

### 2.2 推荐技术路线

我建议采用：

- 数据库：`MySQL 8.x`
- 后端：`Python + FastAPI`
- 数据访问：先用 `PyMySQL` 或 `mysql-connector-python` 直连，后期如有精力再轻量封装
- 前端：保留当前静态页面，逐步把 `localStorage` 替换为 HTTP API

### 2.3 为什么不建议做成“完整淘宝”

- 两周时间不够。
- 课程设计重点是数据库设计质量，不是前端功能广度。
- 模块过多会冲淡 ER 图、索引、触发器、存储过程、运维变更这些核心得分点。

### 2.4 三种可选范围方案

方案 A：纯数据库导向

- 重点做 SQL、存储过程、触发器、报表
- Python 只做少量测试脚本
- 优点：更贴课程要求
- 缺点：现有前端利用率低

方案 B：数据库为主，Python API 为辅

- 保留现有前端壳
- 核心交易逻辑放数据库和 Python 服务中
- 用少量 API 打通下单、支付、取消、查询、统计
- 优点：课程设计与工程能力兼顾
- 缺点：工作量略大，但两周可控

方案 C：全栈扩展型

- 增加角色、优惠券、促销、权限、复杂支付
- 优点：看起来完整
- 缺点：高风险，极易超时

**推荐方案：B。**

## 3. 推荐项目范围

### 3.1 两周内建议保留的核心模块

- 用户管理
- 用户地址管理
- 商品分类管理
- 商品管理
- SKU 管理
- 库存管理
- 购物车管理
- 订单管理
- 模拟支付
- 订单取消
- 订单状态日志
- 库存流水
- 销售统计报表
- 热销商品 Top10
- 运维需求变更

### 3.2 建议砍掉或降级的模块

- `role`、`user_role`
  - 可降级为简单 `is_admin` 字段，不必做完整 RBAC
- `promotion_rule`
  - 可只保留“预留设计”，不做完整促销引擎
- `coupon`、`user_coupon`、`order_discount_record`
  - 课程设计主线不是优惠系统，建议砍掉
- 真实第三方支付
  - 必须砍掉，只做模拟支付
- 多仓库、多供应链、多物流
  - 必须砍掉，否则范围膨胀

### 3.3 最终建议范围

将项目收敛为：

“**单仓小型购物网站数据库系统**”，支持商品浏览、购物车、下单、支付、取消、库存变更、报表统计、运维变更演示。

## 4. 数据库设计六阶段路线

### 4.1 需求分析

产出：

- 系统业务流程说明
- 数据流图
- 数据字典
- 核心业务规则清单

核心业务规则建议：

- 用户可以维护多个收货地址。
- 商品属于一个分类，商品下有多个 SKU。
- 库存按 SKU 管理。
- 下单前必须校验商品状态和 SKU 库存。
- 下单成功后先锁定库存，不直接算已售。
- 支付成功后确认销售并减少锁定库存。
- 取消订单时恢复可售库存并写入库存流水。
- 生产业务数据默认逻辑删除，不直接物理删除。

### 4.2 概念结构设计

核心实体：

- 用户
- 地址
- 分类
- 商品
- SKU
- 购物车
- 购物车明细
- 订单主表
- 订单明细
- 订单状态日志
- 支付记录
- 库存
- 库存流水
- 商品销量统计

核心关系：

- 用户 1:N 地址
- 分类 1:N 商品
- 商品 1:N SKU
- 用户 1:1 购物车
- 购物车 1:N 购物车明细
- 用户 1:N 订单
- 订单 1:N 订单明细
- 订单 1:N 订单状态日志
- SKU 1:1 库存
- SKU 1:N 库存流水
- SKU 1:1 商品销量统计

ER 图建议：

- 先画“核心交易 ER 图”
- 不要一开始混入促销券和权限系统

### 4.3 逻辑结构设计

重点：

- 所有核心表给出主键、外键、唯一约束
- 保留 `is_deleted` 逻辑删除字段给基础资料表
- 适度加入冗余字段服务统计与展示

建议冗余字段：

- `product.total_sold_count`
- `order_main.total_amount`
- `order_main.total_quantity`
- `product_sales_stat.total_sold_count`
- `inventory.available_stock`
- `inventory.locked_stock`

规范化说明：

- 主体设计尽量满足 3NF
- 统计表和冗余字段属于“有理由的反规范化”
- 报告中必须解释“为什么为了查询性能引入冗余”

### 4.4 物理结构设计

高频查询场景：

- 按分类分页查询商品
- 按商品查 SKU
- 按用户查购物车
- 按用户查订单列表
- 按订单查明细
- 支付或取消时按订单号查询
- 创建订单时按 `sku_id` 锁库存
- 热销 Top10 查询
- 月度销售统计

索引设计建议：

- `user.email` 唯一索引
- `category.name` 唯一索引
- `product(category_id, status, is_deleted)`
- `product_sku(product_id, status)`
- `cart_item(cart_id, sku_id)` 唯一索引
- `order_main(user_id, created_at desc)`
- `order_main(order_no)` 唯一索引
- `order_item(order_id)`
- `payment_record(order_id, payment_status)`
- `inventory(sku_id)` 唯一索引
- `inventory_log(sku_id, created_at)`
- `order_status_log(order_id, created_at)`
- `product_sales_stat(total_sold_count desc)` 或按查询需要排序

EXPLAIN 验证要求：

- 至少验证订单列表查询
- 至少验证 Top10 热销查询
- 至少验证月度报表查询
- 至少验证创建订单时的库存定位 SQL

### 4.5 数据库实施

需要完成：

- DDL
- 批量初始化数据 SQL
- 视图
- 触发器
- 存储过程
- 函数
- 测试 SQL

推荐分工：

- 视图：简化商品详情、订单展示、后台报表外模式
- 触发器：维护冗余统计、日志补充、完整性保护
- 存储过程：创建订单、支付订单、取消订单、月报、Top10
- 函数：金额计算、订单状态合法性判断、小型格式化/计算

### 4.6 数据库运行与维护

必须体现：

- 运行测试
- 备份恢复方案
- 运维需求变更
- 数据独立性

建议运维变更案例：

- 原系统销量统计来自 `product.total_sold_count`
- 后续新增 `product_sales_stat` 冗余统计表
- 在不改 API 输入输出的前提下，让报表改查新统计表
- 体现“数据库层做加法，业务代码少改或不改”

## 5. 数据库表设计建议

### 5.1 最终建议保留的表

核心保留：

- `user`
- `user_address`
- `category`
- `product`
- `product_sku`
- `cart`
- `cart_item`
- `order_main`
- `order_item`
- `order_status_log`
- `payment_record`
- `inventory`
- `inventory_log`
- `product_sales_stat`
- `operation_log`

建议删除或仅作为扩展预留：

- `role`
- `user_role`
- `product_image`
- `promotion_rule`
- `coupon`
- `user_coupon`
- `order_discount_record`

### 5.2 每张表的用途

- `user`：保存用户基本信息和登录标识。
- `user_address`：保存用户收货地址。
- `category`：商品分类。
- `product`：商品 SPU 级信息。
- `product_sku`：SKU 级信息，承载规格、价格、上下架状态。
- `cart`：用户购物车主表。
- `cart_item`：购物车中的 SKU 条目。
- `order_main`：订单主表。
- `order_item`：订单明细。
- `order_status_log`：订单状态变更痕迹。
- `payment_record`：模拟支付记录。
- `inventory`：SKU 当前库存快照。
- `inventory_log`：库存增减流水。
- `product_sales_stat`：销量与销售额统计冗余表。
- `operation_log`：运维或关键业务操作日志。

### 5.3 表之间的关系

- `user -> user_address`
- `category -> product`
- `product -> product_sku`
- `user -> cart -> cart_item`
- `user -> order_main -> order_item`
- `order_main -> order_status_log`
- `order_main -> payment_record`
- `product_sku -> inventory`
- `product_sku -> inventory_log`
- `product_sku -> product_sales_stat`

### 5.4 哪些表是核心表

- `user`
- `category`
- `product`
- `product_sku`
- `order_main`
- `order_item`
- `inventory`

### 5.5 哪些表是冗余统计表

- `product_sales_stat`

可选冗余字段所在表：

- `product.total_sold_count`
- `order_main.total_amount`
- `order_main.total_quantity`

### 5.6 哪些表服务于运维变更

- `product_sales_stat`
- `inventory_log`
- `order_status_log`
- `operation_log`

理由：

- 这些表最适合体现“数据库层做加法”和“痕迹保留”

## 6. 视图、触发器、存储过程、函数分工

### 6.1 数据库对象选择原则

- 查询封装优先用视图
- 自动联动维护优先用触发器
- 多步事务业务优先用存储过程
- 返回单值或可嵌入表达式的小计算优先用函数
- 简单 CRUD 可由普通 SQL 或 Python 完成

### 6.2 功能与对象映射

| 功能 | 推荐对象 | 理由 |
| --- | --- | --- |
| 商品详情查询 | 视图 + 普通 SQL | 适合封装商品、分类、SKU、库存摘要 |
| 用户订单查询 | 视图 + 普通 SQL | 列表查询多表关联，适合外模式 |
| 创建订单 | 存储过程 | 多表写入、锁库存、事务回滚 |
| 支付订单 | 存储过程 | 多步状态变更、库存结转、日志写入 |
| 取消订单 | 存储过程 | 多步回滚、状态检查、库存恢复 |
| 库存扣减 | 存储过程主导 | 属于创建订单/支付订单的一部分 |
| 库存恢复 | 存储过程主导 | 属于取消订单的一部分 |
| 订单状态日志 | 触发器或存储过程显式插入 | 课程设计里建议先显式插入，便于理解 |
| 库存流水 | 触发器或存储过程显式插入 | 建议先显式插入，减少调试复杂度 |
| 商品销量统计 | 触发器维护冗余表 | 适合自动累计 |
| 月度销售报表 | 存储过程 | 聚合复杂，减少网络传输 |
| 热销商品 Top10 | 视图或存储过程 | 如果要参数化排名报表，用存储过程更好 |
| 优惠规则计算 | Python 代码 | 本期建议砍掉复杂促销引擎 |
| 运维需求变更 | 视图/触发器/存储过程组合 | 体现数据独立性，不应主要靠改 Python |

### 6.3 本项目的明确决策

- 下单、支付、取消：**存储过程**
- 商品详情、订单列表：**视图 + 普通 SQL**
- 热销榜、月报：**存储过程**
- 销量冗余维护：**触发器**
- 金额或状态辅助判断：**函数**
- 参数校验、异常响应、HTTP 接口：**Python**

## 7. 核心业务流程设计

### 7.1 创建订单流程

1. Python API 接收用户、地址、购物车或直接购买参数。
2. Python 做基础参数校验。
3. 调用存储过程 `sp_create_order(...)`。
4. 存储过程检查商品和 SKU 状态。
5. 使用 `SELECT ... FOR UPDATE` 锁定相关库存行。
6. 校验 `available_stock >= buy_quantity`。
7. 创建 `order_main`。
8. 创建 `order_item`。
9. 更新 `inventory.available_stock -= qty`。
10. 更新 `inventory.locked_stock += qty`。
11. 插入 `inventory_log`。
12. 插入 `order_status_log`。
13. 清理对应 `cart_item`。
14. 任一步失败则回滚。

### 7.2 支付订单流程

1. Python API 接收订单号和模拟支付方式。
2. 调用存储过程 `sp_pay_order(...)`。
3. 检查订单是否为“待支付”。
4. 写入 `payment_record`。
5. 更新 `order_main.status = 'PAID'`。
6. 更新 `inventory.locked_stock -= qty`。
7. 更新 `product.total_sold_count` 或 `product_sales_stat`。
8. 插入 `order_status_log`。
9. 插入 `inventory_log`。
10. 提交事务。

### 7.3 取消订单流程

1. Python API 接收订单号。
2. 调用存储过程 `sp_cancel_order(...)`。
3. 检查订单状态是否允许取消。
4. 恢复 `inventory.available_stock += qty`。
5. 减少 `inventory.locked_stock -= qty`。
6. 更新 `order_main.status = 'CANCELLED'`。
7. 插入 `order_status_log`。
8. 插入 `inventory_log`。
9. 提交事务。

### 7.4 订单状态建议

- `PENDING_PAYMENT`
- `PAID`
- `CANCELLED`

如需扩展可加入：

- `SHIPPED`
- `COMPLETED`

但两周项目建议先控制在前三种。

## 8. Python 后端改造路线

### 8.1 推荐目录结构

```text
docs/
  course_design_learning_plan.md
  requirement.md
  er_diagram.md
  data_dictionary.md
  explain_record.md
  ai_log.md
  work_log.md

sql/
  01_create_database.sql
  02_create_tables.sql
  03_insert_seed_data.sql
  04_views.sql
  05_triggers.sql
  06_functions.sql
  07_procedures.sql
  08_indexes.sql
  09_test_cases.sql
  10_maintenance_change.sql

app/
  main.py
  db.py
  config.py
  routers/
    auth.py
    products.py
    cart.py
    orders.py
    reports.py
  services/
    product_service.py
    cart_service.py
    order_service.py
    report_service.py
  schemas/
    common.py
    product.py
    cart.py
    order.py
    report.py
  utils/
    enums.py
    errors.py
    logger.py

tests/
  test_create_order.py
  test_pay_order.py
  test_cancel_order.py
  test_reports.py
  test_seed_data.py
```

### 8.2 SQL 文件拆分方式

- 按对象类型拆，不要把所有 SQL 写进一个文件。
- 先有表，再有种子数据，再有视图/函数/触发器/存储过程/索引/测试 SQL。
- 运维变更单独成文件，方便报告展示“前后对比”。

### 8.3 Python 文件拆分方式

- `routers` 负责 HTTP 路由
- `services` 负责业务编排
- `db.py` 负责连接与事务包装
- `schemas` 负责请求响应结构
- `utils/enums.py` 放订单状态等枚举

### 8.4 测试文件拆分方式

- 一个核心业务流程一个测试文件
- 一个报表一个测试主题
- SQL 测试与 Python API 测试同时保留

### 8.5 文档文件拆分方式

- `requirement.md`：需求分析
- `er_diagram.md`：ER 设计说明
- `data_dictionary.md`：字段级字典
- `explain_record.md`：索引验证
- `ai_log.md`：AI 使用记录
- `work_log.md`：每日工作日志

### 8.6 工作日志记录方式

建议每天记录：

- 日期
- 当天任务
- 完成情况
- 遇到的问题
- 解决方法
- 第二天计划

### 8.7 AI 使用记录方式

每次让 AI 参与需求、ER、DDL、索引、存储过程、测试时，都要记录：

- 原始 Prompt
- AI 原始建议摘要
- 你发现的问题
- 你怎么改
- 最终是否采纳

## 9. 数据结构训练点

建议在本项目里刻意练这些 Python 数据结构：

- `dict`
  - 购物车条目按 `sku_id` 聚合
- `list`
  - 订单明细、地址列表、测试数据批量生成
- `set`
  - 去重 SKU、去重商品分类
- `Counter`
  - 统计热销商品、测试结果对照
- `deque`
  - 模拟订单状态流或待处理操作队列
- `dataclass`
  - 订单输入、购物车项、报表项
- `Enum`
  - 订单状态、支付状态、库存流水类型

建议专项练习：

- 订单状态机
- 购物车结构转换
- 商品排行榜生成
- 库存校验结果对照
- 批量测试数据生成器

## 10. 计算机网络训练点

- HTTP API 设计
- RESTful 风格路由
- JSON 请求与响应
- 状态码设计
- 前后端交互边界
- 数据库连接池基础认知
- 用报表存储过程减少网络传输

建议你在实现中明确体会：

- 为什么订单创建不应该让前端直接拼 SQL
- 为什么报表接口适合一次返回聚合结果
- 为什么错误码要区分参数错误、业务冲突、系统异常

## 11. 计算机组成原理训练点

- 索引为什么减少磁盘 I/O
- B+Tree 为什么适合范围查询和有序扫描
- 批量插入为什么比单条插入快
- 事务日志与回滚为什么能保证一致性
- 冗余统计表为什么是空间换时间
- 为什么 Top10 榜单适合预聚合

建议在报告里专门解释三件事：

- 为什么 `order_no` 必须唯一索引
- 为什么 `inventory(sku_id)` 必须高频定位
- 为什么月报和热销榜不能完全靠前端循环统计

## 12. vibe coding 协作规范

### 12.1 你和 AI 的分工边界

你必须自己做的决策：

- 需求范围裁剪
- 核心实体与关系
- 哪个功能该用视图/触发器/存储过程/函数
- 哪些字段冗余、为什么冗余
- 哪些功能必须砍掉

AI 可以辅助你的工作：

- 帮你整理需求
- 生成 ER 草稿
- 生成初版 DDL
- 生成存储过程草稿
- 生成测试数据脚本
- 帮你审查索引与 EXPLAIN

### 12.2 AI 使用四步法

1. 先自己判断对象类型和方案。
2. 再给 AI 明确指令，不让 AI 替你做核心决策。
3. 审核 AI 输出，找错、删繁、补业务规则。
4. 记录“原始输出、人工修改、修改理由”。

### 12.3 ai_log.md 模板

```md
# AI 使用记录

## 记录 01

- 使用日期：
- 使用工具：
- 使用阶段：
- 我输入的 Prompt：
- AI 原始输出摘要：
- 我人工审核发现的问题：
- 我人工修改的内容：
- 修改理由：
- 最终是否采纳：
- 反思：
```

### 12.4 10 条高质量 Prompt 示例

1. 需求分析 Prompt  
请根据“小型购物网站数据库管理系统”的题目，围绕用户、商品、SKU、购物车、订单、支付、库存、报表，输出结构化需求分析，要求包含实体候选、业务规则、边界条件，但不要替我决定数据库对象类型。

2. ER 图 Prompt  
我已经确定核心实体为 user、user_address、category、product、product_sku、cart、cart_item、order_main、order_item、payment_record、inventory、inventory_log、product_sales_stat。请基于这些实体输出 ER 图文字版关系说明，标明 1:1、1:N、M:N，并指出可能需要拆表的关系。

3. 表结构审核 Prompt  
我已经设计了以下 MySQL 表结构，请你从主键、外键、唯一约束、字段类型、逻辑删除、冗余字段、3NF 风险几个角度做审查，不要直接重写整套表，只指出问题和修改建议。

4. 存储过程生成 Prompt  
请为 MySQL 8 生成一个存储过程 `sp_create_order`，功能是创建购物订单。要求使用事务、`SELECT ... FOR UPDATE` 锁库存、校验可售库存、写入 order_main/order_item/inventory_log/order_status_log，并在任一步失败时回滚。

5. 触发器生成 Prompt  
请为 `payment_record` 或 `order_main` 设计触发器草稿，用于在订单支付完成后维护 `product_sales_stat` 冗余统计表。请先说明触发点为什么适合用触发器，再给出 MySQL 8 SQL。

6. 索引优化 Prompt  
以下是订单列表查询、商品详情查询、Top10 热销查询、月度报表查询的 SQL 及业务场景。请为 MySQL 8 提出索引建议，并说明每个索引是服务哪条 SQL 的。

7. EXPLAIN 分析 Prompt  
以下是某条 SQL 的 EXPLAIN 输出，请帮我解释 type、key、rows、Extra 分别说明了什么，并判断当前索引是否真正生效。不要只给结论，要逐字段解释。

8. Python API 生成 Prompt  
请使用 FastAPI 生成“创建订单”接口代码，要求包含请求模型、参数校验、异常处理、日志记录，并通过数据库连接调用存储过程 `sp_create_order`，不要把事务逻辑改写到 Python 里。

9. 测试用例生成 Prompt  
请为“创建订单、支付订单、取消订单、库存不足、重复支付、重复取消、月度报表”生成测试用例清单，输出字段包括：测试编号、前置条件、输入、预期结果、涉及表、是否属于边界场景。

10. 课程设计说明书总结 Prompt  
请根据我已经完成的需求分析、ER 图、表结构、索引设计、存储过程、测试结果，帮我整理课程设计说明书第九章总结草稿，重点写收获、不足、AI 使用反思，不要编造未完成内容。

## 13. 14 天学习与开发计划

### Day 1

- 当天目标：完整理解仓库、任务书、说明书，确定项目边界
- 数据库知识：数据库设计六阶段总览
- Python 知识：项目结构阅读、模块职责定位
- vibe coding 技巧：如何写“只分析不改代码”的提示词
- 产物：`course_design_learning_plan.md`
- 验收标准：能口头讲清楚项目现状、范围、主线
- Prompt 示例：请只阅读当前仓库并分析，不要修改代码，输出当前项目已有业务模块与缺失的数据库设计内容。

### Day 2

- 当天目标：完成需求分析初稿
- 数据库知识：业务流程、数据流图、数据字典
- Python 知识：`dict`、`list`、`dataclass`
- vibe coding 技巧：如何让 AI 先列实体候选再由你筛选
- 产物：`docs/requirement.md`
- 验收标准：能列出核心实体、流程、业务规则、边界条件
- Prompt 示例：请根据购物网站下单、支付、取消流程，提取实体、属性、业务规则和异常场景，但不要决定表结构。

### Day 3

- 当天目标：完成 ER 图和概念结构设计
- 数据库知识：实体、属性、联系、基数
- Python 知识：`Enum`
- vibe coding 技巧：要求 AI 输出多个建模方案并比较
- 产物：`docs/er_diagram.md`
- 验收标准：你能解释每条关系为什么是 1:N 或 1:1
- Prompt 示例：请给出 2 套 ER 建模方案，并说明哪套更适合两周内完成的单仓购物网站。

### Day 4

- 当天目标：完成逻辑表设计与数据字典
- 数据库知识：主键、外键、唯一约束、逻辑删除、3NF
- Python 知识：`set`、去重思路
- vibe coding 技巧：让 AI 做审查而不是直接重写
- 产物：`docs/data_dictionary.md`
- 验收标准：所有核心表字段可解释、约束清晰
- Prompt 示例：请审查我设计的表结构，重点指出违反范式、约束缺失、冗余不合理的地方。

### Day 5

- 当天目标：完成物理设计和索引方案
- 数据库知识：索引、组合索引、B+Tree、EXPLAIN
- Python 知识：`Counter`
- vibe coding 技巧：向 AI 提供 SQL + EXPLAIN 上下文
- 产物：`docs/explain_record.md` 初稿
- 验收标准：能说明每个索引服务哪条查询
- Prompt 示例：以下是 4 条高频 SQL，请分别提出索引建议并解释理由。

### Day 6

- 当天目标：编写数据库 DDL 与初始化数据方案
- 数据库知识：DDL、批量插入、种子数据
- Python 知识：批量测试数据生成基础
- vibe coding 技巧：要求 AI 保持文件拆分清晰
- 产物：`sql/01_create_database.sql` 到 `sql/03_insert_seed_data.sql`
- 验收标准：数据库可创建，基础数据可插入
- Prompt 示例：请按数据库、表、初始化数据分文件生成 SQL 草稿，不要把全部内容塞到一个文件。

### Day 7

- 当天目标：设计视图、函数、触发器
- 数据库知识：视图、函数、触发器适用边界
- Python 知识：异常分类思想
- vibe coding 技巧：先声明“我已决定对象类型”
- 产物：`sql/04_views.sql`、`sql/05_triggers.sql`、`sql/06_functions.sql`
- 验收标准：你能解释为什么此处用触发器而不是 Python
- Prompt 示例：我已决定商品详情查询用视图、销量冗余维护用触发器，请生成 MySQL 8 草稿并解释触发时机。

### Day 8

- 当天目标：实现创建订单存储过程
- 数据库知识：事务、回滚、行锁、`SELECT ... FOR UPDATE`
- Python 知识：数据库调用流程
- vibe coding 技巧：要求 AI 显式展示异常分支
- 产物：`sql/07_procedures.sql` 中的 `sp_create_order`
- 验收标准：能覆盖库存不足和回滚场景
- Prompt 示例：请生成 `sp_create_order`，要求显式写出事务开始、库存锁定、异常处理与回滚逻辑。

### Day 9

- 当天目标：实现支付订单、取消订单存储过程
- 数据库知识：状态流转、幂等检查、库存恢复
- Python 知识：`Enum` + 状态机映射
- vibe coding 技巧：让 AI 对边界场景补测试
- 产物：`sp_pay_order`、`sp_cancel_order`
- 验收标准：重复支付、重复取消有明确处理
- Prompt 示例：请为支付和取消流程补充状态合法性检查与幂等保护。

### Day 10

- 当天目标：搭建 Python 后端骨架
- 数据库知识：数据库连接、连接池基础认知
- Python 知识：FastAPI 路由、Pydantic 参数校验、日志
- vibe coding 技巧：让 AI 分文件生成，不要单文件巨石
- 产物：`app/` 基础目录与主入口
- 验收标准：后端可启动，能连数据库
- Prompt 示例：请生成最小 FastAPI 后端骨架，按 routers/services/schemas 拆分。

### Day 11

- 当天目标：接通商品、购物车、订单查询 API
- 数据库知识：视图查询、分页、减少网络传输
- Python 知识：JSON 响应、状态码、异常处理
- vibe coding 技巧：让 AI 先列接口契约再写代码
- 产物：商品和订单查询接口
- 验收标准：前端或脚本可查到真实数据库数据
- Prompt 示例：请先输出商品列表和订单列表接口契约，再生成 FastAPI 代码。

### Day 12

- 当天目标：接通创建订单、支付、取消 API
- 数据库知识：存储过程调用、事务边界
- Python 知识：服务层编排、错误映射
- vibe coding 技巧：要求 AI 保留日志和错误码
- 产物：订单核心 API
- 验收标准：能完成完整下单链路
- Prompt 示例：请生成调用存储过程的 FastAPI 接口，区分参数错误、业务冲突、系统异常。

### Day 13

- 当天目标：完成测试与报表
- 数据库知识：测试 SQL、月报、Top10、EXPLAIN 复核
- Python 知识：测试脚本、结果对照
- vibe coding 技巧：让 AI 帮你补边界测试
- 产物：`tests/`、`sql/09_test_cases.sql`
- 验收标准：核心流程测试通过，报表能查
- Prompt 示例：请为下单、支付、取消、报表生成边界测试清单与测试数据。

### Day 14

- 当天目标：整理说明书、AI 记录、工作日志、答辩材料
- 数据库知识：数据独立性、运维变更总结
- Python 知识：代码结构复盘
- vibe coding 技巧：让 AI 帮你整理，不帮你伪造
- 产物：说明书、`ai_log.md`、`work_log.md`、答辩提纲
- 验收标准：你能独立讲清楚设计决策、SQL 逻辑、AI 审核过程
- Prompt 示例：请根据我已经完成的真实内容，帮我整理课程设计说明书结构和答辩提纲，不要补造未完成功能。

## 14. 最终提交物清单

建议最终提交包括：

- 课程设计说明书
- 源代码压缩包
- SQL 脚本目录
- Python 后端目录
- 测试文件
- AI 使用记录
- 工作日志
- 演示视频
- PPT

建议你在说明书中重点展示：

- 需求分析
- ER 图
- 数据字典
- 索引与 EXPLAIN
- 三个核心存储过程
- 触发器与视图
- 运维变更案例
- AI 记录与人工审核痕迹

## 15. 风险与砍功能建议

### 15.1 当前最大风险

- 想做得太完整，导致数据库核心内容反而做浅了。
- 太早写 Python 接口，导致表结构和事务设计反复返工。
- 让 AI 直接决定对象类型，最后你自己讲不清为什么这么设计。
- 过早引入优惠券、权限、多仓库，范围爆炸。

### 15.2 必要的砍功能建议

如果时间吃紧，按这个顺序砍：

1. 先砍优惠券与促销
2. 再砍完整角色权限
3. 再砍复杂支付状态
4. 再砍后台新增商品页面联调
5. 最后只保留最关键的三个业务流程和两个报表

### 15.3 最低可交付版本

最低可交付版本应至少包含：

- 商品、SKU、用户、地址、购物车、订单、库存的表设计
- 视图
- 触发器
- 存储过程
- 索引
- EXPLAIN 记录
- 创建订单、支付订单、取消订单
- 热销 Top10 与月度销售报表
- 运维需求变更案例
- AI 使用记录和工作日志

---

## 当前结论

这个仓库最有价值的部分不是“现成后端”，而是“现成前端业务壳和演示场景”。接下来的正确做法不是继续在 `localStorage` 上补功能，而是以当前页面为原型，重新建立一套符合课程设计要求的 MySQL + Python 数据库应用主线。

在你明确说“开始修改代码”之前，建议下一步先做两件事：

1. 你确认这份范围裁剪和主线是否认可。
2. 我再基于这份文档继续为你拆出第一阶段的正式执行清单，只列计划，不动代码。
