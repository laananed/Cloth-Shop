# Cloth-Shop 当前项目架构

- 文档生成日期：2026-07-15
- 当前分支：`master`
- 当前 commit：`a6a2295`
- 项目技术栈：原生 HTML/CSS/JavaScript ES Module + FastAPI + PyMySQL + MySQL 8.0.28
- 数据库名称：`frieren_cloth_shop_db`
- 后端端口：`8050`
- 前端端口：`5900`
- 当前自动测试结果：`npm.cmd test` 共 137 项，137 项通过；`src/main.js`、`src/account-store.js`、`src/content.js`、`src/sku-utils.js`、`src/product-ordering.js`、`src/ranking.js` 语法检查和后端 Python 编译检查均通过
- 文档基线：审计起始 commit 为 `a6a2295`（`feat: 调整商品收藏与购物车交互`）；本文档包含当前工作区待提交的阶段 7 收藏夹商品卡片与只读详情查看

> 本文档描述当前代码快照。自动测试以纯函数行为和源码结构契约为主；既有退款轮次已完成专用订单验证。阶段 4 已完成商品介绍的本地 MySQL、HTTP 与浏览器验收；阶段 5 已完成 SKU 选择纯函数与浏览器验收；阶段 6 已完成商品级收藏迁移和操作语义分流；阶段 7 已完成收藏卡片、只读详情、多图预览、下架提示与桌面端/390px 浏览器验收，但未执行真实购物车或订单写入；未执行的项目会明确标注。

## 1. 项目概述

Cloth-Shop 是一个服装商城与进销存管理课程设计。前台承担商品浏览、SKU 选择、收藏、购物车、地址、下单、支付和订单记录；后台承担管理员认证、商品/SKU/图片/库存、订单发货、退款审核和销量统计。FastAPI 提供 HTTP 接口、鉴权、文件上传与事务编排，PyMySQL 连接 MySQL；MySQL 保存商品、库存、订单、支付、日志和销量，并通过视图、存储过程、触发器维护主要业务一致性。

## 2. 核心技术栈

| 层级 | 技术 | 主要职责 |
|---|---|---|
| 页面结构 | HTML | 定义前台、后台、弹窗、侧栏、表单和 `data-*` 交互入口 |
| 视觉层 | CSS | 统一前后台布局、响应式样式、状态和弹窗表现 |
| 浏览器逻辑 | JavaScript ES Module | 页面状态、事件绑定、API 调用、SKU 组合与本地兼容状态 |
| Web API | FastAPI | 路由、参数校验、管理员鉴权、文件上传、错误响应和事务编排 |
| 数据访问 | PyMySQL | 参数化 SQL、视图/存储过程调用、显式提交与回滚 |
| 数据库 | MySQL 8.0.28 | 业务数据、外键/检查约束、视图、存储过程、触发器和函数 |
| 自动测试 | Node.js `node:test` | 纯函数行为测试、HTML/CSS/JS/Python/SQL 源码契约断言 |
| 本地启动 | PowerShell + Batch | 同时启动 Uvicorn `8050` 与静态服务器 `5900`，等待端口就绪 |

## 3. 项目目录结构

```text
Cloth-Shop/
├─ index.html                         # 前台页面、购买弹窗、图片大图和个人中心侧栏
├─ admin.html                         # 后台登录、订单、商品、SKU、统一图片管理弹窗和统计面板
├─ src/
│  ├─ main.js                         # 前后台共享入口；DOM、状态、API 与图片待上传预览等主要业务交互
│  ├─ styles.css                      # 前后台共用样式和响应式规则
│  ├─ content.js                      # 静态文案、分类、17 个展示商品和旧 mock 种子
│  ├─ account-store.js                # localStorage 兼容数据、纯函数和旧后台 mock 辅助
│  ├─ account-state.js                # 未接入当前入口的旧账号/地址状态辅助
│  ├─ ranking.js                      # 销量解析、排序和排名格式化
│  ├─ product-ordering.js             # 商品可售判断和前台排序规则
│  └─ sku-utils.js                    # 颜色×尺码矩阵、SKU 选择和缺失组合生成
├─ backend/
│  ├─ app/
│  │  ├─ main.py                      # FastAPI 应用、全部路由、鉴权、上传、SQL 和事务
│  │  └─ db.py                        # `.env` 加载、PyMySQL 连接和连接上下文
│  ├─ requirements.txt                # Python 依赖清单
│  └─ uploads/products/               # 运行时商品图片目录；文档不枚举具体文件
├─ sql语句/
│  ├─ 01_数据库结构与增量迁移.sql     # 数据库、16 张表和复杂 SKU 增量字段
│  ├─ 02_视图.sql                     # 6 个业务视图及复杂 SKU 商品视图覆盖
│  ├─ 03_存储过程_触发器_函数.sql     # 11 个过程、3 个触发器和 1 个函数
│  ├─ 04_测试数据与验证.sql           # 测试数据、业务流程演示和一致性查询
│  ├─ 05_账号与支付密码初始化.sql     # 支付密码字段/测试用户与管理员初始化
│  └─ 06_商品描述增量迁移.sql         # product.description 与商品详情视图增量
├─ tests/site.test.js                 # 117 项 Node.js 行为与源码结构测试
├─ start_dev.ps1                      # 双服务启动、端口等待和浏览器打开逻辑
├─ start_dev.bat                      # Windows 一键启动入口
├─ package.json                       # `node --test tests/site.test.js`
├─ README.md                          # 项目、初始化、启动和常见问题说明
└─ AGENTS.md                          # 仓库修改、数据库、测试和 Git 约束
```

## 4. 系统分层架构

```mermaid
flowchart LR
    subgraph Browser["浏览器页面 · 前端 5900"]
        Store["前台 index.html"]
        Admin["后台 admin.html"]
        JS["src/main.js 与 ES Module<br/>状态、data-* 事件、渲染"]
        Store --> JS
        Admin --> JS
    end

    JS -->|"HTTP / JSON / multipart<br/>http://127.0.0.1:8050"| API["FastAPI · backend/app/main.py<br/>后端 8050"]
    API --> Auth["管理员令牌校验"]
    API --> Upload["backend/uploads/products<br/>商品图片文件"]
    API --> DBAccess["PyMySQL · backend/app/db.py"]
    DBAccess --> DB[("MySQL<br/>frieren_cloth_shop_db")]
    DB --> Objects["表、视图、存储过程、触发器、函数"]
    Upload -->|"/uploads 静态挂载"| Browser
```

前端通过 `python -m http.server 5900` 提供静态页面；FastAPI 在 `8050` 提供 API，并把 `backend/uploads` 挂载为 `/uploads`。数据库连接使用 `DictCursor`、`utf8mb4`、`autocommit=False`。

## 5. 前台模块

| 模块 | 页面入口 | JavaScript 核心函数/模块 | API | 数据库对象 |
|---|---|---|---|---|
| 商品加载 | `index.html` 的 `data-product-grid` | `loadProductsFromApi()`、`convertApiProducts()`；真实介绍安全转义并保留换行 | `GET /products` | `v_product_detail`、`product_image` |
| 商品搜索 | `data-product-search` | `getProductSearchText()`、`filteredProducts()` | 无；浏览器内过滤 | API 商品内存集合 |
| 商品排序 | 商品网格 | `compareProductsForCustomer()`、`getSalesRankMap()` | 无；浏览器内排序 | `product_sales_stat` 的 API 映射 |
| 多图预览 | 购买弹窗与 `data-image-lightbox` | `getProductImages()`、`renderImageLightbox()`、`showImageLightboxStep()` | 图片随 `GET /products` 返回 | `product_image`、兼容字段 `product.image_url` |
| SKU 选择 | 商品卡 `data-product-sku-id`、共用弹窗 `data-purchase-sku-options` | `getSellableProductSkus()`、`resolveInitialSkuSelection()`、`selectSkuDimension()`、`setPurchaseSku()`、`setPurchaseDimension()`；商品级缓存为 `selectedSkuByProductId` | SKU 随 `GET /products` 返回 | `product_sku`、`inventory` |
| 收藏 | 商品卡、个人中心收藏卡片、共用只读详情弹窗 | `upsertFavorite()`、`renderFavoriteProductItems()`、`renderFavoritesShelf()`、`openPurchaseModal(product, "details")` | 当前未实现收藏 API；详情只复用已加载商品数据，不发新请求 | `localStorage: blue-song-favorites` |
| 加入购物车 | 共用购买弹窗 | `addCartToApi()`、`syncCartFromApi()` | `POST /cart/add`、`GET /cart/{user_id}` | `cart`、`cart_item`、`product_sku`、`inventory` |
| 购物车结算 | 个人中心购物车 | `submitCartCheckout()`、`createOrderFromSelectedCartFromApi()` | `POST /orders/from-cart-selected` | `cart_item`、`order_main`、`order_item`、`inventory`、`inventory_log` |
| 直接购买 | 共用购买弹窗 | `createDirectOrderFromApi()`、`submitPurchaseOrder()` | `POST /orders/direct` | `order_main`、`order_item`、`inventory`、`inventory_log` |
| 地址管理 | 个人中心地址面板 | `loadAddressesFromApi()`、`addAddressToApi()`、`setDefaultAddressToApi()`、`deleteAddressFromApi()` | `GET /addresses/user/{user_id}`、`POST /addresses/add`、`/set-default`、`/delete` | `user_address` |
| 订单记录 | 个人中心订单面板 | `loadOrdersFromApi()`、`renderApiOrders()`、`showOrderDetail()` | `GET /orders/user/{user_id}`、`GET /orders/{order_id}` | `v_order_summary`、`v_user_order_detail`、支付/状态/库存日志 |
| 支付 | 购买弹窗和待支付订单 | `payOrderFromApi()`、`payOrderWithPasswordPrompt()` | `POST /orders/pay` | `user.pay_password_hash`、`order_main`、`payment_record`、`inventory`、`product_sales_stat` |
| 取消订单 | 待支付订单操作 | `cancelOrderFromApi()`、`handleCancelOrder()` | `POST /orders/cancel` | `order_main`、`order_status_log`、`inventory`、`inventory_log` |
| 退款申请 | 已支付/已发货订单操作 | `refundOrderFromApi()`、`handleRefundOrder()` | `POST /orders/refund` | `order_main`、`order_status_log`；订单级请求只发送 `user_id`、`order_id`、`remark` |

重要页面契约包括 `data-product-id`、`data-product-sku-id`、`data-purchase-color`、`data-purchase-size`、`data-purchase-payment-title`、`data-purchase-address-id`、`data-cart-select-id`、`data-cart-checkout`、`data-order-detail-id`、`data-order-pay-id`、`data-order-cancel-id` 和 `data-order-refund-id`。修改标记名必须同步检查 `index.html`、`src/main.js` 与 `tests/site.test.js`。

## 6. 后台模块

| 模块 | 页面入口 | JavaScript 核心函数/模块 | API | 数据库对象 |
|---|---|---|---|---|
| 管理员登录 | `data-admin-login-form` | `loginAdmin()`、`renderAdminAuthState()` | `POST /admin/login` | `user` |
| 登录状态恢复 | 页面初始化 | `getStoredAdminSession()`、`requireAdminSessionBeforeLoading()`、`adminFetch()` | 通过首批受保护 API 验证，无独立 `/admin/me` | `sessionStorage` + `user` |
| 商品搜索和筛选 | 商品管理面板 | `getFilteredAdminProductRows()`、后台 `renderProducts()` | 无新增请求；内存过滤 | `GET /admin/inventory` 已加载结果 |
| 新增商品 | `data-admin-product-form` | `buildSkuMatrix()`、`createAdminProductToApi()`；提交最多 1000 字普通文本介绍，新生成 SKU 默认库存 50 | `POST /products` | `category`、`product.description`、`product_sku`、`inventory`、`product_sales_stat`、`product_image` |
| 编辑或清空商品介绍 | 商品卡“编辑介绍”与 `data-admin-description-editor` | `updateAdminProductDescriptionToApi()`、`refreshAdminProductsFromApi()` | `PATCH /admin/products/{product_id}/description` | `product.description` |
| SKU 管理 | `data-admin-sku-manager` | `loadAdminProductSkusToApi()`、`createAdminProductSkusToApi()`、`updateAdminProductSkuToApi()`、`deleteAdminProductSkuToApi()` | `GET/POST /admin/products/{product_id}/skus`、`PATCH/DELETE /admin/products/{product_id}/skus/{sku_id}` | `product_sku`、`inventory`、`product_sales_stat` |
| 库存更新 | 商品卡和 SKU 管理器 | `updateAdminSkuStockToApi()` | `POST /admin/inventory/update-stock` | `inventory` |
| 商品上下架 | 商品管理面板 | `updateAdminProductStatusToApi()` | `POST /admin/products/update-status` | `product`、`product_sku` |
| 商品逻辑删除 | 商品管理面板 | `deleteAdminProductToApi()` | `POST /admin/products/delete` | `product.is_deleted`、`product_sku.is_deleted` |
| 图片查看、追加和删除 | 商品卡唯一的 `data-admin-product-image-manage` 入口与 `data-admin-image-manager` 弹窗 | `renderAdminProductImageManager()`、`submitAdminImageManagerUpload()`、`appendAdminProductImagesToApi()`、`deleteAdminProductImageToApi()` | `POST/DELETE /admin/products/{product_id}/images...` | `product_image`、兼容主图 `product.image_url` |
| 后台订单 | 订单面板 | `loadAdminOrdersFromApi()`、`renderAdminOrderDetail()` | `GET /admin/orders`、`GET /admin/orders/{order_id}` | `v_order_summary`、`v_user_order_detail`、支付/状态/库存日志 |
| 发货和取消发货 | 订单操作列 | `shipAdminOrderToApi()`、`unshipAdminOrderToApi()` | `POST /admin/orders/ship`、`/unship` | `order_main`、`order_status_log` |
| 退款同意和拒绝 | 退款待处理订单 | `approveAdminRefundToApi()`、`rejectAdminRefundToApi()` | `POST /admin/orders/refund/approve`、`/reject` | `order_main`、`inventory`、`inventory_log`、`payment_record`、`product_sales_stat` |
| 销量统计 | 销量统计面板 | `refreshAdminStatsFromApi()`、`convertApiStatsToRenderedStats()` | `GET /admin/stats` | `order_main`、`order_item`、`product`、`v_product_sales_rank` |
| 操作日志现状 | 当前无独立页面 | 订单详情只展示状态日志和库存流水 | 当前无 `operation_log` API | `operation_log` 仅有 SQL 测试数据，运行时未读写 |

后台导航当前只有订单查看、商品管理、新增商品、销量统计四项。商品接口失败且不是 401/403 时，前端仍可能回退到 `localStorage` 的 mock 商品，这是数据库权威数据源方向下需要收敛的兼容逻辑。

## 7. 后端 API 结构

### 商品与 SKU

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| GET | `/products` | 查询商品介绍、结构化 SKU、库存、销量和图片 | 公开 | `v_product_detail`、`product_image` |
| POST | `/products` | multipart 新增商品、普通文本介绍、复杂 SKU、库存和图片 | 管理员 Bearer 令牌 | `category`、`product`、`product_sku`、`inventory`、`product_sales_stat`、`product_image` |
| PATCH | `/admin/products/{product_id}/description` | 修改或清空最多 1000 字的商品介绍 | 管理员 Bearer 令牌 | `product.description` |
| GET | `/admin/products/{product_id}/skus` | 查询商品全部 SKU（含逻辑删除项） | 管理员 Bearer 令牌 | `product_sku`、`inventory` |
| POST | `/admin/products/{product_id}/skus` | 批量新增缺失 SKU 组合 | 管理员 Bearer 令牌 | `product_sku`、`inventory`、`product_sales_stat` |
| PATCH | `/admin/products/{product_id}/skus/{sku_id}` | 修改维度、价格、库存和在售状态 | 管理员 Bearer 令牌 | `product_sku`、`inventory` |
| DELETE | `/admin/products/{product_id}/skus/{sku_id}` | 逻辑删除 SKU，禁止删除最后一个有效 SKU | 管理员 Bearer 令牌 | `product_sku` |

### 图片

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| POST | `/admin/products/{product_id}/images` | 向已有商品追加多张图片 | 管理员 Bearer 令牌 | `product`、`product_image` |
| DELETE | `/admin/products/{product_id}/images/{image_id}` | 逻辑删除图片；删除主图时提升下一张 | 管理员 Bearer 令牌 | `product`、`product_image` |

当前没有独立图片查询 API；图片数组附加在商品/后台库存响应中。后台商品卡只保留“管理图片”入口，弹窗统一查看已有图片、选择与预览待上传图片、确认上传和删除；上传、删除成功后均重新加载 `GET /admin/inventory`，同步刷新弹窗和商品卡。当前仍没有手动指定任意图片为主图的 API。

### 购物车

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| GET | `/cart/{user_id}` | 查询用户购物车与实时 SKU/库存状态 | 未做用户令牌校验 | `cart`、`cart_item`、`product_sku`、`product`、`inventory` |
| POST | `/cart/add` | 添加 SKU；同 SKU 累加数量 | 未做用户令牌校验 | `sp_add_to_cart`、`cart`、`cart_item` |
| POST | `/cart/update-quantity` | 修改购物车项数量并校验归属/库存 | 未做用户令牌校验 | `sp_update_cart_item_quantity`、`cart_item`、`inventory` |
| POST | `/cart/delete-item` | 删除指定购物车项 | 未做用户令牌校验 | `sp_delete_cart_item`、`cart_item` |

### 地址

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| GET | `/addresses/user/{user_id}` | 查询未删除地址 | 未做用户令牌校验 | `user_address` |
| POST | `/addresses/add` | 新增地址，可设为默认 | 未做用户令牌校验 | `user_address` |
| POST | `/addresses/set-default` | 切换默认地址 | 未做用户令牌校验 | `sp_set_default_address`、`user_address` |
| POST | `/addresses/delete` | 逻辑删除地址 | 未做用户令牌校验 | `sp_delete_user_address`、`user_address` |

### 订单与支付

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| POST | `/orders/from-cart` | 整个购物车创建待支付订单 | 未做用户令牌校验 | `sp_create_order_from_cart`、订单/购物车/库存表 |
| POST | `/orders/from-cart-selected` | 仅用选中购物车项创建订单 | 未做用户令牌校验 | `sp_create_order_from_selected_cart_items`、订单/购物车/库存表 |
| POST | `/orders/direct` | 校验 SKU 后直接创建待支付订单 | 未做用户令牌校验 | `sp_create_direct_order`、`order_main`、`order_item`、`inventory` |
| POST | `/orders/pay` | 校验订单归属和 6 位支付密码后支付 | 未做用户令牌校验 | `user`、`sp_pay_order`、`payment_record`、`inventory`、`product_sales_stat` |
| POST | `/orders/cancel` | 取消待支付订单并释放锁定库存 | 未做用户令牌校验 | `sp_cancel_order`、`order_main`、`inventory`、日志表 |
| GET | `/orders/user/{user_id}` | 查询用户订单列表 | 未做用户令牌校验 | `v_order_summary` |
| GET | `/orders/{order_id}` | 查询订单、支付、状态和库存流水 | 未做用户令牌校验 | `v_order_summary`、`v_user_order_detail`、日志表 |

### 退款

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| POST | `/orders/refund` | 锁定归属订单，将已支付/已发货订单改为退款待处理 | 未做用户令牌校验；按请求体 `user_id` 校验订单归属 | `order_main`、`order_status_log` |
| POST | `/admin/orders/refund/approve` | 恢复库存、记录退款、回滚销量并完成退款 | 管理员 Bearer 令牌 | `order_main`、`inventory`、`inventory_log`、`payment_record`、`product_sales_stat` |
| POST | `/admin/orders/refund/reject` | 恢复退款申请前的 `PAID` 或 `SHIPPED` | 管理员 Bearer 令牌 | `order_main`、`order_status_log` |

### 管理员认证

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| POST | `/admin/login` | 校验管理员邮箱、密码、管理员标记并签发 8 小时令牌 | 公开登录入口 | `user` |

当前未实现 `/admin/me`、服务器端 token 存储、撤销列表或登出 API。

### 后台商品

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| GET | `/admin/inventory` | 查询未删除商品的介绍、全部 SKU、库存、销量和图片 | 管理员 Bearer 令牌 | `v_product_detail`、`product_image` |
| POST | `/admin/inventory/update-stock` | 锁定库存行后修改 `available_stock` | 管理员 Bearer 令牌 | `product_sku`、`inventory` |
| POST | `/admin/products/update-status` | 同步上下架商品和全部有效 SKU | 管理员 Bearer 令牌 | `product`、`product_sku` |
| POST | `/admin/products/delete` | 逻辑删除商品和全部有效 SKU | 管理员 Bearer 令牌 | `product`、`product_sku` |

### 后台订单

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| GET | `/admin/orders` | 查询全部订单 | 管理员 Bearer 令牌 | `v_order_summary` |
| GET | `/admin/orders/{order_id}` | 查询订单完整详情 | 管理员 Bearer 令牌 | `v_order_summary`、`v_user_order_detail`、支付/状态/库存日志 |
| POST | `/admin/orders/ship` | `PAID → SHIPPED` | 管理员 Bearer 令牌 | `order_main`、`order_status_log` |
| POST | `/admin/orders/unship` | `SHIPPED → PAID` | 管理员 Bearer 令牌 | `order_main`、`order_status_log` |

### 统计

| 方法 | 路径 | 作用 | 权限 | 主要数据库对象 |
|---|---|---|---|---|
| GET | `/admin/stats` | 汇总订单、销售额、件数、商品数和 SKU 销量排行 | 管理员 Bearer 令牌 | `order_main`、`order_item`、`product`、`v_product_sales_rank` |

## 8. 数据库结构

### 8.1 核心表

| 表 | 作用 | 关键关系 |
|---|---|---|
| `user` | 普通用户、管理员和密码/支付密码载体 | 被地址、购物车、订单、操作日志引用；`email` 唯一 |
| `user_address` | 用户收货地址、默认地址和逻辑删除 | `user_id → user.id`；被订单引用 |
| `category` | 商品分类与排序 | 被 `product.category_id` 引用；`name` 唯一 |
| `product` | 商品主数据、可空普通文本介绍、状态和兼容主图 | 属于分类；被 SKU、图片引用 |
| `product_image` | 商品多图、主图、排序和逻辑删除 | `product_id → product.id` |
| `product_sku` | SKU 编码、名称、颜色、尺码、价格、状态 | `product_id → product.id`；被库存、购物车、订单、销量引用 |
| `inventory` | 每个 SKU 的可用库存和锁定库存 | `sku_id → product_sku.id` 且唯一 |
| `cart` | 用户活动购物车 | `user_id → user.id` 且唯一 |
| `cart_item` | 购物车 SKU 与数量 | 引用 `cart`、`product_sku`；`(cart_id, sku_id)` 唯一 |
| `order_main` | 订单号、用户、地址、状态和总金额 | 引用 `user`、`user_address`；`order_no` 唯一 |
| `order_item` | 下单时的 SKU、数量和成交价快照 | 引用 `order_main`、`product_sku` |
| `payment_record` | 支付和退款记录 | `order_id → order_main.id` |
| `order_status_log` | 订单状态迁移日志 | `order_id → order_main.id` |
| `inventory_log` | SKU 库存变化流水 | `sku_id → product_sku.id`，`ref_no` 关联业务单号 |
| `operation_log` | 操作人、动作类型和备注 | `operator_id → user.id`；当前仅测试数据使用 |
| `product_sales_stat` | SKU 累计销量和销售额 | `sku_id` 同时是主键和外键，一 SKU 一行 |

主要唯一约束还包括 `cart.user_id`、`inventory.sku_id`、`cart_item(cart_id, sku_id)`；复杂 SKU 增量增加 `sku_code` 与 `(product_id, color_name, size_name, is_deleted)` 查询索引，但 SQL 未声明 `sku_code` 或颜色尺码组合的数据库唯一约束，唯一性主要由后端事务内查询校验。

### 8.2 实体关系图

```mermaid
erDiagram
    USER ||--o{ USER_ADDRESS : owns
    USER ||--o| CART : owns
    USER ||--o{ ORDER_MAIN : creates
    USER ||--o{ OPERATION_LOG : operates
    USER_ADDRESS ||--o{ ORDER_MAIN : receives
    CATEGORY ||--o{ PRODUCT : contains
    PRODUCT ||--o{ PRODUCT_IMAGE : has
    PRODUCT ||--o{ PRODUCT_SKU : has
    PRODUCT_SKU ||--o| INVENTORY : stocks
    PRODUCT_SKU ||--o| PRODUCT_SALES_STAT : summarizes
    PRODUCT_SKU ||--o{ INVENTORY_LOG : records
    CART ||--o{ CART_ITEM : contains
    PRODUCT_SKU ||--o{ CART_ITEM : selected_as
    ORDER_MAIN ||--o{ ORDER_ITEM : contains
    PRODUCT_SKU ||--o{ ORDER_ITEM : ordered_as
    ORDER_MAIN ||--o{ PAYMENT_RECORD : pays
    ORDER_MAIN ||--o{ ORDER_STATUS_LOG : transitions
```

### 8.3 视图、存储过程与触发器

#### 视图

| 名称 | 用途 | 关联业务 |
|---|---|---|
| `v_product_detail` | 商品介绍、SKU、库存、销量的联合明细；最终版本包含颜色、尺码和库存更新时间 | 前台商品、后台库存 |
| `v_user_cart_detail` | 用户购物车、商品、SKU、金额与库存 | 购物车展示 |
| `v_user_order_detail` | 订单、地址、明细、商品、SKU 和支付联合详情 | 前后台订单详情 |
| `v_inventory_status` | 可用/锁定/总库存和库存状态 | 后台库存、库存预警 |
| `v_product_sales_rank` | 按 SKU 销量和销售额计算排名 | 首页排名、后台统计 |
| `v_order_summary` | 订单品类数、件数和金额汇总 | 前后台订单列表、统计 |

#### 存储过程

| 名称 | 用途 | 关联业务 |
|---|---|---|
| `sp_add_to_cart` | 创建购物车或累加同 SKU 数量 | 加入购物车 |
| `sp_create_order_from_cart` | 整车下单、锁定库存、生成明细、清空购物车 | 购物车结算 |
| `sp_create_order_from_selected_cart_items` | 只结算选中购物车项 | 当前前台购物车结算 |
| `sp_create_direct_order` | 不经过购物车直接创建待支付订单 | 立即购买 |
| `sp_pay_order` | 支付订单、消耗锁定库存、写支付记录 | 支付、销量 |
| `sp_cancel_order` | 取消待支付订单并释放锁定库存 | 取消订单 |
| `sp_update_cart_item_quantity` | 校验用户、库存后修改数量 | 购物车改量 |
| `sp_delete_cart_item` | 删除用户购物车项 | 购物车删除 |
| `sp_set_default_address` | 清除旧默认并设置新默认地址 | 地址管理 |
| `sp_delete_user_address` | 逻辑删除地址 | 地址管理 |
| `sp_refund_paid_order` | 旧的已支付订单退款过程 | 当前 FastAPI 未调用；退款审核由 Python 事务实现 |

#### 触发器与函数

| 名称 | 类型 | 用途 |
|---|---|---|
| `trg_order_main_after_insert` | 触发器 | 新订单插入后写入初始状态日志 |
| `trg_order_main_after_update` | 触发器 | 状态变化后写日志；状态转为 `PAID` 时维护销量 |
| `trg_inventory_before_update` | 触发器 | 阻止可用库存或锁定库存更新为负数 |
| `fn_get_stock_status` | 函数 | 将可用库存转换为缺货、低库存或正常状态 |

### 8.4 SQL 初始化顺序

1. `sql语句/01_数据库结构与增量迁移.sql`：创建数据库、15 张基础表、`product_image` 扩展表，并增加复杂 SKU 字段与索引。
2. `sql语句/02_视图.sql`：创建 6 个业务视图，最后用复杂 SKU 版本覆盖 `v_product_detail`。
3. `sql语句/03_存储过程_触发器_函数.sql`：创建购物车、订单、支付、取消、地址和退款过程，以及状态/库存触发器和库存状态函数。
4. `sql语句/04_测试数据与验证.sql`：清理并写入固定测试数据，执行下单/支付/取消演示和一致性查询；只应在测试数据库使用。
5. `sql语句/05_账号与支付密码初始化.sql`：补充支付密码哈希字段，初始化测试用户支付密码与管理员账号。
6. `sql语句/06_商品描述增量迁移.sql`：幂等增加 `product.description`，并覆盖 `v_product_detail` 以透传商品介绍。

从零初始化时必须按以上顺序执行。已存在数据库只需在原有 `01`～`05` 基础上执行 `06`；`04` 当前是固定规模演示数据（16 商品、32 SKU、8 订单等），不是大量销售压力数据。

## 9. 核心业务链路

### 9.1 商品加载与 SKU 选择

```mermaid
sequenceDiagram
    actor User as 用户
    participant Page as index.html
    participant JS as src/main.js
    participant API as GET /products
    participant View as v_product_detail
    participant Tables as product/product_sku/inventory/product_sales_stat
    participant Images as product_image

    Page->>JS: 初始化静态商品骨架
    JS->>API: 请求数据库商品
    API->>View: 查询商品与 SKU 联合视图
    View->>Tables: 关联商品、SKU、库存、销量
    Tables-->>View: SKU 行
    API->>Images: query_product_images()
    Images-->>API: 有效图片列表
    API-->>JS: 商品行 + images
    JS->>JS: convertApiProducts() 按 product_id 合并 SKU
    JS-->>Page: 渲染商品、价格、库存、销量和多图
    User->>Page: 在商品卡选择 SKU 或打开购物车/立即购买弹窗
    Page->>JS: 写入 selectedSkuByProductId / openPurchaseModal()
    JS->>JS: resolveInitialSkuSelection() 校验商品、SKU、删除状态、在售状态和库存
    JS->>JS: 有效显式选择优先；唯一可售 SKU 自动选择；多个可售 SKU 保持未选
    User->>Page: 选择普通 SKU 或颜色与尺码
    Page->>JS: setPurchaseSku() / selectSkuDimension()
    JS-->>Page: 锁定真实 sku_id，同步商品卡、价格、库存、数量上限和按钮状态
    Page->>JS: submitPurchaseOrder()
    JS->>JS: 购物车与直接购买复用弹窗当前精确 SKU
```

### 9.2 商品收藏、加入购物车与立即购买语义

```mermaid
sequenceDiagram
    actor User as 用户
    participant Card as 商品卡
    participant JS as src/main.js
    participant Store as blue-song-favorites
    participant Cart as POST /cart/add
    participant Order as POST /orders/direct 和 /orders/pay

    User->>Card: 点击收藏
    Card->>JS: toggleFavorite(product)
    JS->>Store: 商品级规范化、切换并写回 localStorage
    JS-->>Card: 同步 aria-pressed、aria-label 和 is-favorited
    JS-->>User: 留在当前页面，不打开弹窗或侧栏

    User->>Card: 点击加入购物车
    Card->>JS: openPurchaseModal(product, cart)
    JS->>Cart: 精确 sku_id、数量和现有 user_id
    Cart-->>JS: 同步数据库购物车
    JS-->>User: 在弹窗内显示结果，不自动打开购物车侧栏

    User->>Card: 点击立即购买
    Card->>JS: openPurchaseModal(product, buy)
    JS->>Order: 精确 sku_id、地址、数量、支付方式和支付密码
    Order-->>User: 保持既有订单状态与订单侧栏行为
```

收藏记录以商品为唯一单位，规范字段为 `id`、`productId`、`name`、`category`、`image`、`detail`、`price`、`badge`，不保存 `skuId`、`skuName`、颜色或尺码。读取 `blue-song-favorites` 时，`normalizeProductFavorites()` 优先使用当前商品数据补齐展示字段；同一商品的旧 SKU 记录会合并为一条并立即写回。只有稳定 `id` 的遗留记录也会剥离 `-sku-*` 后缀后保留；无法形成稳定商品标识的损坏项被单独忽略，不影响其他收藏；重复读取幂等。收藏按钮不受商品/SKU 可售状态限制，但逻辑删除且未出现在 `GET /products` 的商品没有入口。

阶段 7 的收藏夹通过 `renderFavoriteProductItems()` 将本地收藏快照与本轮成功返回的 `GET /products` 商品合并。存在实时商品时，以实时名称、分类、价格、介绍、图片、在售状态和多图列表为准；API 尚未成功加载或商品已不在实时列表时，只展示本地快照，并将详情入口禁用为“商品暂不可用”。静态商品视觉兜底不被视为实时商品数据，因此不会误开详情。收藏卡片只展示商品级信息，不渲染 SKU、颜色或尺码。

“查看详情”和收藏图片入口复用购买弹窗的 `details` 模式，只读展示完整介绍、价格、销量、销售状态、SKU 概要和已有图片画廊；地址、SKU 选择、数量、支付、合计、提交按钮和操作反馈均隐藏。该模式不调用 SKU 初选、不改写 `selectedSkuByProductId`、不加载地址、不写购物车/订单，也不触发新的商品请求。详情弹窗可在收藏侧栏之上关闭；图片灯箱打开时，第一次 `Esc` 只关闭灯箱，第二次再关闭详情，收藏侧栏保持打开。

### 9.3 购物车结算

```mermaid
sequenceDiagram
    actor User as 用户
    participant UI as 购物车侧栏
    participant JS as submitCartCheckout()
    participant API as POST /orders/from-cart-selected
    participant SP as sp_create_order_from_selected_cart_items
    participant DB as MySQL 事务

    User->>UI: 勾选有效购物车项、地址和支付方式
    UI->>JS: 提交 cart_item_ids
    JS->>API: user_id + address_id + cart_item_ids
    API->>SP: CALL，传入选中项 JSON
    SP->>DB: 锁定购物车项、SKU 与库存
    DB->>DB: 校验归属、状态、库存和地址
    DB->>DB: 创建 order_main/order_item
    DB->>DB: available_stock 转 locked_stock，写 inventory_log
    DB->>DB: 删除已结算 cart_item
    API->>DB: commit；异常 rollback
    API-->>JS: order_id、order_no、汇总、明细、库存流水
    JS->>JS: 重新同步购物车并提示支付密码
```

`POST /orders/from-cart` 及 `createOrderFromCartFromApi()` 仍存在，但当前 UI 使用选中项接口。

### 9.4 直接购买与支付

```mermaid
sequenceDiagram
    actor User as 用户
    participant UI as 购买弹窗
    participant JS as src/main.js
    participant Direct as POST /orders/direct
    participant Pay as POST /orders/pay
    participant DB as MySQL

    User->>UI: 选择颜色、尺码、数量、地址
    UI->>JS: submitPurchaseOrder()
    JS->>JS: 校验商品、真实 sku_id、在售状态和前端库存
    JS->>Direct: user_id、address_id、sku_id、quantity
    Direct->>DB: validate_sku_for_purchase() + CALL sp_create_direct_order
    DB->>DB: 锁库存，创建待支付订单和明细，写库存流水
    Direct-->>JS: PENDING_PAYMENT 订单
    JS->>User: 请求 6 位支付密码
    User->>JS: 输入密码和支付方式
    JS->>Pay: user_id、order_id、pay_method、pay_password
    Pay->>DB: 校验用户支付密码和订单归属
    Pay->>DB: CALL sp_pay_order
    DB->>DB: PENDING_PAYMENT → PAID
    DB->>DB: 消耗 locked_stock，写 payment_record
    DB->>DB: 触发器累计 product_sales_stat 并写状态日志
    Pay-->>JS: 支付结果、订单汇总和支付记录
```

### 9.5 退款审核

```mermaid
sequenceDiagram
    actor User as 用户
    participant Front as 前台
    participant Apply as POST /orders/refund
    participant Admin as 后台退款审核
    participant Approve as POST /admin/orders/refund/approve
    participant Reject as POST /admin/orders/refund/reject
    participant DB as MySQL

    User->>Front: 对 PAID/SHIPPED 订单申请退款
    Front->>Apply: user_id、order_id、remark
    Apply->>DB: 按 user_id/order_id 锁定订单并校验 PAID/SHIPPED
    DB->>DB: PAID/SHIPPED → REFUND_REQUESTED，触发状态日志
    Apply-->>Front: 退款申请已提交，等待商家处理

    Note over Admin,DB: 以下审核链路已实现，但前提是订单已处于 REFUND_REQUESTED
    Admin->>Approve: 同意退款
    Approve->>DB: 锁定并校验订单状态
    DB->>DB: 恢复 available_stock，写 REFUND_RESTORE 库存流水
    DB->>DB: 写 REFUND/SUCCESS payment_record
    DB->>DB: 回滚 product_sales_stat
    DB->>DB: REFUND_REQUESTED → REFUNDED，触发状态日志
    Approve-->>Admin: 完整订单、支付、状态和库存流水

    Admin->>Reject: 或拒绝退款
    Reject->>DB: 从 order_status_log 读取申请前状态
    DB->>DB: REFUND_REQUESTED → PAID 或 SHIPPED
    Reject-->>Admin: 恢复后的订单详情
```

退款申请与后台审核沿用两阶段状态机：申请阶段只进入 `REFUND_REQUESTED`，不恢复库存、不回滚销量、不写退款成功记录；管理员同意后才执行退款一致性处理，拒绝时恢复申请前状态。

### 9.6 商品新增与复杂 SKU

```mermaid
sequenceDiagram
    actor AdminUser as 管理员
    participant Form as 后台新增商品表单
    participant SKU as sku-utils.js
    participant API as POST /products
    participant Files as backend/uploads/products
    participant DB as MySQL 事务

    AdminUser->>Form: 输入分类、商品、介绍、颜色、尺码、基础价格并选择多图
    Form->>SKU: buildSkuMatrix(颜色, 尺码, 已编辑行)
    SKU-->>Form: 颜色×尺码组合；新行库存默认 50，已有行保留编辑值
    Form->>API: multipart + description + skus_json + images + Bearer token
    API->>API: 校验管理员、介绍长度、SKU 重复和图片后缀/大小
    API->>Files: 保存 UUID 图片；第一张作为主图
    API->>DB: 创建或复用 category
    DB->>DB: 插入 product.description 与 product_image
    DB->>DB: 逐行插入 product_sku、inventory、product_sales_stat
    API->>DB: commit；失败 rollback 并清理本批已保存文件
    API-->>Form: 新商品、SKU 和图片结果
```

后台新建商品时，商品介绍为可选字段，去除首尾空白后最多 1000 个字符，空字符串落库为 `NULL`；中文、多行文本按原换行展示。新生成的颜色 × 尺码 SKU 默认库存为 50；管理员仍可逐行改为包括 0 在内的非负整数，提交时 `skus_json` 使用界面中的实际值。已有商品在“管理规格”中新增缺失组合仍沿用默认库存 0，本轮未改变数据库 `inventory.available_stock` 的安全默认值或后端库存规则。

### 9.7 后台商品图片管理

```mermaid
sequenceDiagram
    actor AdminUser as 管理员
    participant Card as 商品管理卡片
    participant Modal as 图片管理弹窗
    participant JS as src/main.js
    participant API as 现有图片 API
    participant Inventory as GET /admin/inventory

    AdminUser->>Card: 点击唯一“管理图片”入口
    Card->>Modal: 展示商品 ID、有效图片、主图标记和上传区
    AdminUser->>Modal: 多选新图片
    Modal->>JS: 本地去重并创建预览 URL，不发送请求
    AdminUser->>Modal: 移除单项、清空或确认上传
    JS->>API: POST /admin/products/{product_id}/images
    API-->>JS: 返回最新 images、image_url 和 image_count
    JS->>Inventory: 重新加载后台商品
    Inventory-->>Modal: 刷新弹窗图片与商品卡主图/数量
    AdminUser->>Modal: 确认删除已有图片
    JS->>API: DELETE /admin/products/{product_id}/images/{image_id}
    API-->>JS: 返回删除后的图片和主图
    JS->>Inventory: 重新加载并保持弹窗打开
```

待上传文件只存在于当前弹窗内存状态，以文件名、大小、`lastModified` 和 MIME 类型组合去重。单项移除、清空、上传成功、关闭弹窗和页面卸载都会释放本地对象 URL；关闭后打开其他商品不会沿用文件或反馈。数据库结构、API 路径、字段、逻辑删除和删除主图后的自动提升规则均未改变。图片逻辑删除仍不会自动清理磁盘文件。

### 9.8 商品介绍展示与后台编辑

```mermaid
sequenceDiagram
    actor AdminUser as 管理员
    participant Modal as 商品介绍编辑弹窗
    participant API as PATCH /admin/products/{product_id}/description
    participant DB as product.description
    participant Inventory as GET /admin/inventory
    participant Store as GET /products

    AdminUser->>Modal: 编辑不超过 1000 字的中文或多行介绍
    Modal->>API: JSON description + Bearer token
    API->>DB: 锁定有效商品并参数化更新；空内容写 NULL
    API-->>Modal: product_id + description
    Modal->>Inventory: 刷新后台商品卡
    Store->>Store: description 映射为 detail，SKU 摘要单独映射
    Store-->>AdminUser: 非空介绍安全转义并保留换行；空介绍不渲染
```

商品介绍的数据权威来源是 `product.description`。`GET /products` 与 `GET /admin/inventory` 都返回 `description`；前台只将数据库介绍映射到 `detail`，SKU 组合摘要保留在独立的 `skuSummary`，不再覆盖商品介绍。编辑接口继续使用管理员令牌、事务与参数化 SQL；不存在或已逻辑删除的商品返回 404，超过 1000 字由请求模型返回 422。

## 10. 数据来源与状态管理

| 数据来源 | 当前职责 | 权威性与限制 |
|---|---|---|
| MySQL | 商品/SKU/库存、数据库购物车、地址、订单、支付、退款审核、销量、状态与库存流水 | 核心交易数据权威来源；阶段 4 已在本地库验证商品介绍迁移、写入、查询、清空和恢复 |
| `sessionStorage` | 保存 `cloth_shop_admin_session`（管理员 ID、邮箱、token） | 仅浏览器会话；刷新后由首批受保护请求间接验证，无 `/admin/me` |
| `localStorage` | 前台本地账号资料、商品级收藏、购物车快照、购物车勾选项；旧后台商品/mock 订单 | 收藏以 `blue-song-favorites` 商品级规范记录为准并自动迁移旧 SKU 记录；收藏卡片优先合并本轮 API 实时商品，历史快照只作不可用兜底；购物车商品以数据库为业务源但 UI 使用回读快照；后台 API 失败仍有 mock 回退 |
| `src/content.js` | 品牌文案、分类、17 个静态商品、展示图片、旧 mock 订单种子 | API 失败时用于视觉兜底和测试，不包含可购买的真实 SKU/库存 |
| `backend/uploads/products` | 新增和追加商品图片文件 | 数据库保存访问路径；删除图片当前只逻辑删数据库记录，不删除磁盘文件 |
| `src/account-store.js` | 本地存储、金额/排名展示纯函数和旧 mock 辅助 | 当前仍被前台收藏/缓存与后台失败回退使用，不能视为已完全淘汰 |
| `src/account-state.js` | 重复的注册、地址、profile 辅助 | 当前未被页面入口或 `main.js` 导入 |

已迁移到数据库的主要业务包括商品/SKU/库存、购物车增删改、地址、订单、支付、后台商品、后台订单与销量统计。仍属本地或兼容逻辑的包括普通用户登录/注册资料、商品级收藏、购物车勾选项、数据库购物车的 UI 快照、静态商品视觉兜底、旧后台 mock 商品/订单辅助。收藏不新增数据库表或后端 API；购物车继续以真实 `sku_id` 为数据库业务单位。

`selectedSkuByProductId` 是页面会话内的商品级 SKU 选择缓存，不写入 `localStorage`。商品卡和共用操作弹窗都读写这一个缓存：有效显式选择会恢复；失效、下架、删除、售罄或不属于当前商品的选择会被丢弃；唯一可售 SKU 会自动写入缓存；多个可售 SKU 且没有显式选择时保持未选。结构化 SKU 恢复时同时恢复 `color`、`size` 与真实 `skuId`，不同商品按 `product.id` 隔离。

## 11. 权限与数据一致性

- **管理员登录和令牌**：`POST /admin/login` 通过邮箱、MySQL `SHA2` 密码和 `is_admin` 校验；令牌是 `admin_user_id:expires_at:HMAC-SHA256` 的 URL-safe Base64，默认 8 小时。密钥当前硬编码在后端源码中。
- **后台接口权限**：后台商品、SKU、图片、库存、订单和统计接口调用 `require_admin_user()`，要求 Bearer token，并重新查询用户的管理员/删除状态。
- **普通用户权限限制**：前台交易接口没有普通用户 token；大量接口直接信任路径或请求体中的 `user_id`。`GET /orders/{order_id}` 也没有订单归属认证。这是课程演示实现，不是生产级权限模型。
- **401/403 行为**：前端 `adminFetch()` 能识别 401/403，三个主要列表刷新路径会清会话和后台数据；部分后端列表接口的通用异常捕获可能把鉴权异常包装为 500，部分局部操作也不会立即触发统一退出。
- **逻辑删除**：商品、SKU、图片、地址均保留历史数据；商品删除同步将有效 SKU 下架并标记删除，SKU 删除禁止删除最后一个有效 SKU。
- **SKU 与库存校验**：下单前后端均检查真实 `sku_id`、商品/SKU 状态和可用库存；存储过程锁定行，库存触发器阻止负库存。
- **订单状态**：核心状态包括 `PENDING_PAYMENT`、`PAID`、`CANCELLED`、`SHIPPED`、`REFUND_REQUESTED`、`REFUNDED`；状态变化由触发器写 `order_status_log`。代码中也有 `COMPLETED` 显示文案，但当前没有完成订单的 API。
- **支付**：支付校验订单归属和 6 位支付密码，调用 `sp_pay_order`，在事务中释放锁定库存、写支付记录并联动销量。
- **退款**：管理员同意退款的库存恢复、支付记录、销量回滚和状态更新位于同一事务；拒绝退款从状态日志恢复申请前状态。
- **退款申请**：`RefundOrderRequest` 定义 `user_id`、`order_id`、`remark`；`refund_order()` 按订单归属锁定 `order_main`，只允许 `PAID` 或 `SHIPPED` 进入 `REFUND_REQUESTED`，并保留明确的非法状态错误与事务回滚。
- **事务与回滚**：PyMySQL 关闭自动提交；商品/图片/SKU/订单/支付/退款/库存/状态写操作显式 `commit()`，异常路径 `rollback()`。商品图片在数据库事务失败时清理本批新文件，但图片逻辑删除不会清理磁盘文件。
- **操作审计限制**：`operation_log` 有表结构和测试数据，却没有后端读写/API/页面；管理员接口返回的部分 `action_type` 也没有落库。

## 12. 测试体系

### 当前实际结果

| 命令 | 结果 |
|---|---|
| `npm.cmd test` | 137/137 通过，0 失败、0 跳过、0 TODO |
| `node --check src/account-store.js` | 通过 |
| `node --check src/main.js` | 通过 |
| `node --check src/sku-utils.js` | 通过 |
| `node --check src/product-ordering.js` | 通过 |
| `node --check src/ranking.js` | 通过 |
| `backend/.venv/Scripts/python.exe -m py_compile backend/app/main.py` | 通过 |
| `backend/.venv/Scripts/python.exe -m py_compile backend/app/db.py` | 通过 |
| 本地 MySQL 迁移 | `06_商品描述增量迁移.sql` 连续执行 2 次成功；字段为可空 `TEXT`，视图包含 `description`，商品/SKU/库存数量保持 41/89/89 |
| 本地 API 冒烟 | 公共/后台查询、未登录 401、中文多行修改、超长 422、不存在与已删除 404、清空和回读均通过 |
| 浏览器定向验收 | 后台新增表单、介绍编辑/提交中锁、重新打开、前台展示/搜索、清空、图片管理、购买弹窗、桌面与 390px 窄屏通过；控制台 0 error |
| 阶段 5 SKU 浏览器验收 | 普通多 SKU 未选、弹窗切换并回写商品卡、购物车/收藏/立即购买入口恢复同一 SKU、单 SKU 自动选择、商品 A/B 隔离、支付控件按动作显示、桌面与 390px 无横向溢出通过；全新前后台标签页控制台 0 error；未提交购物车、收藏或订单 |
| 阶段 6 收藏/购物车浏览器验收 | 多 SKU 商品直接收藏和取消、刷新恢复、收藏夹单条商品名与删除、下架商品收藏可用且购物车/购买禁用、购物车精确 SKU/数量/3 个地址、立即购买支付控件、桌面与 390px 无横向溢出通过；控制台 0 error；收藏数据已恢复，未提交购物车或订单 |
| 阶段 7 收藏卡片/详情浏览器验收 | 实时商品卡片、图片与详情双入口、5 图切换和灯箱、介绍空值文案、下架状态、详情控件隔离、两级 Esc、删除同步、桌面与 390px 无横向溢出通过；详情打开未产生新资源请求，控制台 0 error；临时收藏已恢复，未写购物车、订单或数据库 |
| 浏览器自动操作新增商品 SKU 表单 | 2 色×3 尺码生成 6 行且均为 50；人工改为 35 后新增尺码，旧值保留、新行 50；库存可改为 0；未提交商品，控制台 0 错误 |
| 浏览器自动操作统一图片管理弹窗 | 34 张商品卡各只有一个“管理图片”入口；旧入口为 0；弹窗商品/图片/主图/空上传状态正确；关闭后切换商品无状态串用；1280px 与 390px 均无横向溢出；控制台 0 错误；未真实上传或删除 |

### 已覆盖模块

- 直接执行 `content.js`、`ranking.js`、`product-ordering.js`、`account-store.js`、`sku-utils.js` 的纯函数行为。
- 覆盖销量排名、可售优先排序、地址迁移/本地存储、商品级收藏规范化/去重/幂等迁移/切换、收藏卡片实时数据优先/快照兜底/不可用状态、详情模式控件隔离与 SKU 缓存保护、购物车金额、注册校验、SKU 笛卡尔积、新增商品 SKU 默认库存 50、矩阵重建时保留人工库存、已有商品缺失组合仍默认 0、颜色尺码选择和不可售组合禁用、有效/失效显式 SKU 恢复、唯一可售 SKU 自动选择、多 SKU 未选、商品级缓存同步和 ES Module 缓存版本契约，以及后台图片唯一入口、商品介绍迁移/接口/安全展示/编辑弹窗契约。
- 读取 `index.html`、`admin.html`、`src/main.js`、`src/styles.css`、后端 Python、SQL、README 和启动脚本，断言路由字符串、`data-*` 钩子、字段、CORS、端口、图片、认证、订单和 SKU 结构。

137 项中相当一部分是 `readFileSync(...).includes(...)` 或正则形式的源码结构断言；它们能锁定契约，但不是浏览器或 API 端到端测试。

### 尚未覆盖或本轮未执行

- **自动化 HTTP 冒烟测试**：尚未纳入常驻测试套件；阶段 4 使用本地临时脚本覆盖商品介绍状态矩阵并在结束后恢复数据。
- **真实 API 测试范围**：商品介绍已覆盖 200、401、404、422、清空与回读；尚未覆盖令牌过期、数据库故障注入和其他接口的完整状态矩阵。
- **真实数据库测试**：阶段 4 已连接本地 MySQL 8.0.28，验证迁移幂等、字段/视图、中文多行、`NULL`、数量不变和数据恢复；未执行故障注入回滚或并发测试。
- **浏览器测试**：测试套件未内置浏览器框架；阶段 4 完成商品介绍浏览器回归，阶段 5 完成 SKU 选择同步回归，阶段 6 完成商品级收藏与三类入口回归，阶段 7 完成实时收藏卡片、详情/图片入口、5 图画廊、下架详情、控件隔离、两级 Esc、删除同步和 390px 响应式验收。旧 SKU 收藏的合并、损坏记录隔离、不可用历史快照和非空介绍由纯函数或源码契约覆盖；浏览器控制面未直接注入旧 localStorage，当前数据库也没有带非空介绍的可验收前台商品。未执行真实购物车/订单写入或完整网络拦截；仅通过浏览器资源时间线确认打开详情没有新增请求。
- **退款回归**：已覆盖请求模型字段、退款路由不读取 SKU 字段、不调用购买校验、订单归属锁、允许状态、状态更新、提交/回滚、业务错误保留以及前端订单级请求体。

## 13. 本地启动流程

1. 启动 MySQL 8.0，并确认将使用 `frieren_cloth_shop_db`。
2. 按第 8.4 节顺序执行 `sql语句/` 下 `01`～`06`。`04` 会清空并重建测试数据，只能用于测试库；已有数据库只执行尚未应用的增量脚本。
3. 在 `backend/.env` 配置 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`；不要提交或公开该文件。
4. 若虚拟环境不存在，在仓库根目录执行 `python -m venv backend/.venv`。
5. 安装依赖：`backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt`。
6. 在仓库根目录执行 `start_dev.bat`，或执行 `powershell -ExecutionPolicy Bypass -File .\start_dev.ps1`。
7. 后端 API：`http://127.0.0.1:8050`。
8. 前台：`http://127.0.0.1:5900/index.html`。
9. 后台：`http://127.0.0.1:5900/admin.html`；Swagger：`http://127.0.0.1:8050/docs`。
10. 手动启动时，后端工作目录必须是 `backend`：`backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8050`；前端工作目录是仓库根目录：`backend\.venv\Scripts\python.exe -m http.server 5900`。

常见问题：MySQL 未启动或 `.env` 配置不匹配；`8050`/`5900` 被旧进程占用；虚拟环境缺包；SQL 未按顺序执行导致视图/过程缺失；浏览器缓存旧 ES Module；上传目录无写权限。`POST /products` 使用 multipart，而 `backend/requirements.txt` 当前未显式列出 `python-multipart`，新环境若在表单路由加载时报依赖错误，需要先核对实际安装环境和依赖清单。`backend/uploads` 当前未被 `.gitignore` 排除，新上传文件应避免误提交。

## 14. 高耦合文件与修改边界

| 文件 | 高耦合原因 | 修改时必须联动检查 |
|---|---|---|
| `src/main.js` | 同时包含前台、后台、DOM、状态、API 和兼容逻辑 | 两个 HTML 的 `data-*`、所有 API 字段、local/sessionStorage、SKU 工具、订单/图片/认证回归测试 |
| `backend/app/main.py` | 单文件包含 38 个路由、模型、上传、鉴权、SQL 和事务 | Pydantic 模型、前端请求、SQL 对象、状态机、提交/回滚、错误码和上传清理 |
| `src/styles.css` | 前后台共用且大量状态类依赖 JS | 响应式布局、隐藏/活动状态、弹窗、侧栏、管理面板和测试中的选择器断言 |
| `tests/site.test.js` | 同时覆盖纯函数与大量源码字符串契约 | 修改路径、函数名、字段、端口、文案、`data-*` 或 SQL 时区分行为测试与结构断言 |
| `sql语句/01-06` | 表、视图、过程、触发器、测试数据、账号初始化和商品介绍增量按序耦合 | 增量迁移、外键/索引、最终覆盖视图、过程重建、测试数据与 README 执行顺序 |

禁止因文件体积大而整体重写。跨层功能应按“页面 → `data-*` → `main.js` → API → Pydantic → SQL/过程/事务 → 响应 → 重渲染”逐段验证。

## 15. 当前完成度与后续开发

### 已形成完整闭环

- **商品介绍**：新建商品可选填介绍，`product.description` 持久化，商品列表与后台库存接口透传，前台安全展示并保留换行，后台独立弹窗可查看、修改、清空和刷新；空内容统一保存为 `NULL`。
- **复杂 SKU**：颜色×尺码生成、真实 SKU ID、价格/库存/状态选择、后台增删改和逻辑删除链路齐全；新建商品的新组合默认库存为 50，矩阵重建保留已有编辑值，已有商品新增缺失组合仍默认 0。
- **前台 SKU 选择同步**：商品卡与购物车/立即购买共用弹窗共享商品级有效 SKU；有效显式选择优先恢复，唯一可售 SKU 自动选择，多 SKU 无显式选择保持未选，失效缓存被清理；普通 SKU 与结构化颜色/尺码最终都解析为真实 `skuId`。
- **商品级收藏与操作语义**：收藏按钮直接切换商品级 localStorage 记录，不要求 SKU、数量、地址或支付方式，不自动打开弹窗/侧栏；旧 SKU 收藏自动去重迁移，商品卡 ARIA 状态、刷新恢复和收藏夹删除同步完成。购物车仍使用精确 `sku_id` 与现有弹窗，成功或失败均不自动打开侧栏；立即购买和支付/订单侧栏行为不变。数据库、SQL 与后端接口无变化。
- **收藏夹卡片与只读详情**：收藏侧栏展示主图、商品名、分类、介绍摘要、价格、图片提示和详情/删除操作；实时商品详情可查看完整介绍、销售状态、SKU 概要与多图灯箱，下架商品仍可只读查看。历史快照在无实时商品时保留并禁用详情；详情不触发请求、不选择 SKU、不修改购物车/订单，关闭后收藏侧栏保持原位。数据库、SQL 与后端接口无变化。
- **多图片**：多图上传、数据库图片列表、主图兼容、前台缩略图/大图和逻辑删除链路齐全；后台商品卡只保留“管理图片”入口，统一弹窗承担已有图片查看、新图片选择与本地预览、单项移除、清空、确认上传和删除。
- **购物车与下单**：数据库购物车增删改、选中项结算、直接购买、待支付订单、取消订单和库存锁定/释放链路齐全。
- **后台订单**：订单列表/详情、发货、取消发货、状态日志和库存流水展示链路齐全。
- **销量**：支付累计、退款回滚和后台统计代码链路齐全。
- **退款申请与审核**：订单级申请、归属与状态校验、`REFUND_REQUESTED` 状态日志、重复申请拦截、后台同意/拒绝及退款一致性处理链路齐全；本轮已用专用订单完成真实 MySQL/API 的支付后申请与管理员同意验证。

以上结论来自当前代码、SQL、自动测试及定向运行验证；商品介绍已完成真实数据库、API 和浏览器验收，前台 SKU 同步、商品级收藏与阶段 7 收藏详情已完成纯函数与定向浏览器验收，退款申请和管理员同意分支沿用既有真实验收记录，其他浏览器交互仍未完整验收。

### 基本完成但需要真实业务验收

- **支付**：支付密码、订单归属、支付记录、库存和销量链路存在，需要在真实 MySQL 中验证成功、错误密码、重复支付和事务回滚。
- **图片文件一致性**：新增失败能清理本批文件，但逻辑删除不删磁盘文件，需要验收长期文件治理。
- **管理员认证**：登录、恢复、退出和主要 401/403 清理存在，需要验证异常包装为 500 的接口和令牌过期行为。
- **SQL 初始化与业务过程**：`04` 提供演示流程和一致性查询，但本轮未实际执行 SQL。

### 尚未完成

- 普通用户没有真实登录/注册 API 和用户 token；当前账号资料是本地存储，交易使用固定测试用户 ID。
- `operation_log` 没有运行时写入、查询 API 或后台页面，不能作为管理员审计闭环。
- 没有订单“完成/确认收货”API；仅存在 `COMPLETED` 显示文案。
- 没有手动设置任意商品图片为主图的接口。
- 收藏图标红色、购物车图标黄色、数量徽章和数据库收藏均未实现，属于后续阶段。
- 没有纳入常驻套件的自动化 HTTP、真实数据库、并发事务或浏览器端到端测试；当前真实数据库验证覆盖既有退款场景和阶段 4 商品介绍场景，阶段 7 浏览器验收只写入并恢复 localStorage 收藏，未写入购物车、订单或数据库数据。
- `04` 只有固定规模测试数据，不是大量销售、压力或容量测试数据。
- 当前仓库没有完成可直接交付的课程报告、PPT 和讲解视频闭环。

### 可以延后优化

- 在保持接口兼容的前提下拆分 `src/main.js` 与 `backend/app/main.py` 的职责。
- 收敛后台数据库失败时的 mock 商品回退，并清理未接入的 `account-state.js`、旧本地订单/商品辅助。
- 增加服务器端 token 管理、普通用户鉴权和细粒度资源归属校验。
- 补充上传文件内容检测、磁盘孤儿文件清理、操作日志落库与查询页面。
- 建立可自动清理的 API/数据库 fixture、浏览器测试和大批量销售数据生成工具。
- 在功能和测试基线稳定后，从本文档提取课程报告、PPT 与讲解视频素材。

## 16. 文档维护规则

出现以下任一变化时必须更新本文档：

- 新增、删除或移动核心文件；
- API 方法、路径、请求/响应字段或权限变化；
- 数据库表、字段、外键、索引、视图、过程、触发器或函数变化；
- `sql语句/` 初始化顺序或测试数据规模变化；
- 前端 `5900`、后端 `8050` 或数据库连接方式变化；
- 新增、删除或修复核心业务闭环；
- 管理员/普通用户鉴权与 token 策略变化；
- 数据权威来源、localStorage/sessionStorage 或 mock 回退策略变化；
- 自动测试数量、覆盖范围、命令或结果口径变化。

更新时必须重新记录分支、commit、日期和真实测试结果，并以当前代码、SQL 和运行证据为准，不沿用旧计划或历史对话结论。

本文档是当前代码结构快照，不代替 README、数据库设计文档或测试报告。
