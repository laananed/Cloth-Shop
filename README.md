# 服装商城项目启动说明

本文档用于记录本项目的本地启动方式。项目包含：

- 前端：原生 HTML / CSS / JavaScript
- 后端：FastAPI
- 数据库：MySQL
- 后端端口：`8050`
- 前端端口：`5500`

---

## 一、启动前确认

启动前请先确认 MySQL 已经启动，并且数据库存在：

```text
frieren_cloth_shop_db
```

后端数据库连接配置通常在：

```text
backend/.env
```

当前测试用户：

```text
CURRENT_USER_ID = 2
CURRENT_ADDRESS_ID = 3
测试支付密码 = 123456
```

---

## 二、推荐启动方式：使用一键脚本

如果项目根目录已经有：

```text
start_dev.bat
```

直接双击运行即可。

运行后应该会打开两个命令行窗口：

```text
Backend 8050
Frontend 5500
```

浏览器访问：

```text
http://127.0.0.1:5500/index.html
```

后端接口文档访问：

```text
http://127.0.0.1:8050/docs
```

---

## 三、手动启动方式

如果一键脚本不可用，可以手动启动。

### 1. 启动后端

打开一个终端，进入后端目录。

目录结构一般是：

```text
项目根目录/
├─ backend/
│  ├─ app/
│  │  ├─ __init__.py
│  │  ├─ main.py
│  │  └─ db.py
│  └─ .env
├─ index.html
└─ src/
   ├─ main.js
   └─ styles.css
```

所以需要进入：

```bash
cd 项目根目录\backend
```

然后运行：

```bash
python -m uvicorn app.main:app --reload --port 8050
```

启动成功后，浏览器打开：

```text
http://127.0.0.1:8050/docs
```

如果能看到 FastAPI 文档页面，说明后端启动成功。

---

### 2. 启动前端

再打开一个新的终端，进入 `index.html` 所在目录。

如果 `index.html` 在项目根目录，则运行：

```bash
cd 项目根目录
python -m http.server 5500
```

然后浏览器打开：

```text
http://127.0.0.1:5500/index.html
```

---

## 四、常见问题

### 1. `ModuleNotFoundError: No module named 'app'`

通常是后端启动目录不对。

正确方式：

```bash
cd 项目根目录\backend
python -m uvicorn app.main:app --reload --port 8050
```

错误方式：

```bash
cd 项目根目录\backend\app
python -m uvicorn app.main:app --reload --port 8050
```

原因是后端代码中使用了：

```python
from app.db import ...
```

所以必须在包含 `app` 文件夹的 `backend` 目录下启动。

如果偶尔保存 `main.py` 后出现该错误，可能是 `uvicorn --reload` 热重载瞬间失败。一般停止后端后重新运行即可。

---

### 2. 前端页面空白

优先打开：

```text
F12 → Console
```

如果看到 `SyntaxError`，说明 `src/main.js` 有语法错误，整个模块没有执行。

如果只是后端接口失败，页面通常不会完全空白，因为前端有静态商品兜底。

---

### 3. 修改了 `main.js` 但页面没变化

可能是浏览器缓存。可以：

1. 修改 `index.html` 中的版本号，例如：

```html
<script type="module" src="./src/main.js?v=20260708a"></script>
```

2. 浏览器按：

```text
Ctrl + F5
```

---

### 4. 端口被占用

如果提示端口被占用，可以先关闭之前打开的终端窗口。

后端端口：

```text
8050
```

前端端口：

```text
5500
```

---

## 五、当前主要接口

后端文档地址：

```text
http://127.0.0.1:8050/docs
```

常用接口：

```text
GET  /products
GET  /cart/{user_id}
POST /cart/add
POST /cart/update-quantity
POST /cart/delete-item

POST /orders/direct
POST /orders/from-cart-selected
POST /orders/pay
POST /orders/cancel
GET  /orders/user/{user_id}
GET  /orders/{order_id}
```

---

## 六、当前业务流程

### 1. 直接购买

```text
选择商品规格
→ 点击立即购买
→ 提交订单
→ 生成待支付订单
→ 输入支付密码 123456
→ 支付成功
→ 查看订单详情
```

### 2. 购物车购买

```text
加入购物车
→ 修改数量
→ 删除不需要的商品
→ 勾选部分商品
→ 选择支付方式
→ 提交已选商品订单
→ 输入支付密码 123456
→ 支付成功
→ 查看订单详情
```

### 3. 待支付订单

```text
提交订单后不输入支付密码
→ 订单保留为待支付
→ 可以在购买记录中继续支付
→ 也可以取消订单
```

---

## 七、建议启动顺序

每次开发建议按这个顺序：

```text
1. 启动 MySQL
2. 启动后端 8050
3. 打开 http://127.0.0.1:8050/docs 检查接口文档
4. 启动前端 5500
5. 打开 http://127.0.0.1:5500/index.html
6. F12 打开 Console 和 Network 观察错误
```

---

## 八、Git 提交建议

每完成一个独立功能，建议单独提交。

示例：

```bash
git add .
git commit -m "feat: 添加商品 SKU 规格选择"
```

常用提交信息：

```text
feat: 添加订单详情展示
feat: 添加支付密码确认流程
feat: 添加购物车单个商品删除功能
feat: 添加商品 SKU 规格选择
fix: 同步购物车数量修改到数据库
```
