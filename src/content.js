const COLLECTIONS = [
  {
    title: '日常轻搭',
    summary: '白色短袖、针织上衣和蓝调套装组成轻松日常线，突出清爽、可爱和好搭配。',
    accent: '晨雾白',
  },
  {
    title: '幻夜出行',
    summary: '白色过膝袜、黑丝、灰色外套与机能外搭集中表现夜色感和舞台感。',
    accent: '夜幕灰',
  },
  {
    title: '东风和韵',
    summary: '和服与浴衣保留节庆与柔和气质，用更安静的色彩撑住一整套氛围。',
    accent: '花见金',
  },
  {
    title: '纯白礼赞',
    summary: '礼服、白色轻纱裙和白裙主题围绕纯净、发光、仪式感展开。',
    accent: '月华银',
  },
  {
    title: '主题限定',
    summary: '女仆、圣诞和趣味套装专门承接角色扮演感，做更强记忆点的展示。',
    accent: '莓果红',
  },
  {
    title: '海岛假日',
    summary: '海边连衣裙与泳衣系列主打度假、清凉和风感，更适合做夏日橱窗主推。',
    accent: '潮汐蓝',
  },
  {
    title: '居家轻眠',
    summary: '睡衣单独成组，强调私享、柔软和陪伴感，适合补足店铺节奏。',
    accent: '暖杏粉',
  },
];

const PRODUCT_DEFINITIONS = [
  {
    id: 'product-01',
    badge: '主推',
    name: '月湾白露短袖轻裙',
    category: '日常轻搭',
    price: 199,
    sales: '5.2k',
    detailLayout: 'price-sales-rank',
    purchaseLayout: 'buy',
    detail: '以白色短袖和柔软荷叶边撑起清爽感，适合做首页第一眼的亲和系主推。',
  },
  {
    id: 'product-02',
    badge: '热卖',
    name: '夜海巡礼过膝袜套装',
    category: '幻夜出行',
    price: 259,
    sales: '4.8k',
    detail: '披风、过膝袜和法杖元素一起拉出强烈舞台感，视觉记忆点非常集中。',
  },
  {
    id: 'product-03',
    badge: '新作',
    name: '深海蓝格纹主题套装',
    category: '主题限定',
    price: 239,
    sales: '4.4k',
    detail: '蓝白撞色和趣味帽饰更偏角色装，适合做店铺里的活泼调味款。',
  },
  {
    id: 'product-04',
    badge: '限定',
    name: '花宴晴空新岁和服',
    category: '东风和韵',
    price: 299,
    sales: '4.05k',
    detail: '亮黄色和服配大蝴蝶结，节庆感很足，适合做新春与庆典主题陈列。',
  },
  {
    id: 'product-05',
    badge: '人气',
    name: '流光夜巡黑丝外搭',
    category: '幻夜出行',
    price: 219,
    sales: '3.88k',
    detail: '黑丝、束带和透明外层做出利落夜行感，整体更酷也更显腿部线条。',
  },
  {
    id: 'product-06',
    badge: '推荐',
    name: '废墟灰影机能外套',
    category: '幻夜出行',
    price: 229,
    sales: '3.64k',
    detail: '灰黑机能风和亮红配件形成反差，适合作为暗色调分区的门面款。',
  },
  {
    id: 'product-07',
    badge: '新品',
    name: '晨雾灰连帽叠穿外套',
    category: '幻夜出行',
    price: 209,
    sales: '3.36k',
    detail: '灰色外套加连帽内搭更偏日常酷感，适合补足轻机能线的层次。',
  },
  {
    id: 'product-08',
    badge: '高光',
    name: '鎏金回眸露背礼服',
    category: '纯白礼赞',
    price: 399,
    sales: '3.12k',
    detail: '逆光金边和露背剪裁把礼服的仪式感拉满，非常适合做高客单镇店款。',
  },
  {
    id: 'product-09',
    badge: '夏日',
    name: '海雾蝶影长檐连衣裙',
    category: '海岛假日',
    price: 289,
    sales: '2.94k',
    detail: '大檐帽、花瓣和海岸线营造出完整度假感，适合做夏日橱窗宣传图。',
  },
  {
    id: 'product-10',
    badge: '轻甜',
    name: '晚霞潮音飘纱连衣裙',
    category: '海岛假日',
    price: 269,
    sales: '2.68k',
    detail: '浅蓝连衣裙和晚霞海面让画面非常轻盈，适合主打梦幻少女感。',
  },
  {
    id: 'product-11',
    badge: '柔光',
    name: '云阶白羽系带长裙',
    category: '纯白礼赞',
    price: 309,
    sales: '2.42k',
    detail: '低饱和白裙和缎带鞋把纯净气质做得很完整，适合放在高级感专区。',
  },
  {
    id: 'product-12',
    badge: '日常',
    name: '雪绒奶霜针织套装',
    category: '日常轻搭',
    price: 189,
    sales: '2.18k',
    detail: '高领毛衣配短裤和堆堆袜，有明显冬日感，也很适合做轻松日常搭配。',
  },
  {
    id: 'product-13',
    badge: '限定',
    name: '铃音双角女仆套装',
    category: '主题限定',
    price: 249,
    sales: '1.96k',
    detail: '红黑蝴蝶结加双角头饰很有角色辨识度，适合主题活动时重点陈列。',
  },
  {
    id: 'product-14',
    badge: '轻纱',
    name: '雏菊水镜白裙',
    category: '纯白礼赞',
    price: 279,
    sales: '1.74k',
    detail: '雏菊、水纹和白裙形成通透的轻纱气质，适合作为纯白系列补位款。',
  },
  {
    id: 'product-15',
    badge: '百搭',
    name: '云朵短款方领上衣',
    category: '日常轻搭',
    price: 169,
    sales: '1.58k',
    detail: '方领短上衣和黑色蝴蝶结简单直接，适合做高转化的基础搭配单品。',
  },
  {
    id: 'product-16',
    badge: '节日',
    name: '暖炉圣夜斗篷套装',
    category: '主题限定',
    price: 239,
    sales: '1.32k',
    detail: '圣诞帽、斗篷和暖色背景足够应景，适合在节日档期做限定曝光。',
  },
  {
    id: 'product-17',
    badge: '私享',
    name: '晨醒缎带睡裙',
    category: '居家轻眠',
    price: 159,
    sales: '1.08k',
    detail: '白色睡裙和卧室场景自带亲密与柔软感，适合补齐居家线氛围。',
  },
  {
    id: 'product-18',
    badge: '海风',
    name: '薄荷海盐轻纱泳衣',
    category: '海岛假日',
    price: 329,
    sales: '920',
    detail: '薄荷色荷叶边和草帽披肩很适合夏日宣传，整体观感明亮又轻盈。',
  },
  {
    id: 'product-19',
    badge: '雅韵',
    name: '绀紫花冠晨光浴衣',
    category: '东风和韵',
    price: 289,
    sales: '760',
    detail: '花冠、湿发和浴衣氛围更偏柔和私语感，适合做安静收尾的压轴图。',
  },
];

function buildProduct(product) {
  return {
    ...product,
    detailLayout: product.detailLayout ?? 'split',
    purchaseLayout: product.purchaseLayout ?? 'buy',
    image: `./assets/products/${product.id}.png`,
  };
}

export function getSiteCopy() {
  return {
    brandName: '汐雾衣橱',
    slogan: '把轻甜、海风和角色感都挂进同一面橱窗。',
    intro: '围绕同一位白发精灵主角重构的 19 件图像型商品，用更强氛围和更统一的宣传图来带动点击。',
    primaryCta: '浏览新目录',
    secondaryCta: '查看分区',
    note: '19 个商品 · 图像重做 · 轻裁展示',
  };
}

export function getCollections() {
  return COLLECTIONS;
}

export function getProducts() {
  return PRODUCT_DEFINITIONS.map(buildProduct);
}
export function getAuthCheckoutContract() {
  return {
    auth: {
      loginMethod: 'email-password',
      session: 'cookie-or-token',
    },
    address: {
      mode: 'address-book',
      fields: ['recipientName', 'phone', 'province', 'city', 'detail'],
      extensible: true,
    },
    paymentMethods: ['alipay', 'wechat', 'cod'],
    sidebar: {
      sections: ['account', 'address', 'orders', 'favorites', 'cart'],
    },
    order: {
      requiresAuth: true,
      requiresAddress: true,
      historySource: 'backend',
    },
  };
}

export function getPersonalCenterContract() {
  return {
    account: {
      fields: ['email', 'displayName'],
    },
    address: {
      fields: ['recipientName', 'phone', 'province', 'city', 'detail'],
    },
    orders: {
      fields: ['orderNo', 'status', 'items', 'totalPrice', 'createdAt'],
    },
    favorites: {
      fields: ['id', 'name', 'price', 'badge'],
    },
    cart: {
      fields: ['id', 'name', 'price', 'quantity'],
    },
  };
}

export function getAdminImageOptions() {
  return getProducts().map((product) => ({
    id: product.id,
    label: product.name,
    image: product.image,
  }));
}

export function getAdminMockOrdersSeed(products = getProducts()) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const makeLineItem = (id, quantity) => {
    const product = byId.get(id);
    return {
      id,
      name: product?.name || id,
      category: product?.category || '未分类',
      price: product?.price || 0,
      quantity,
    };
  };

  const orders = [
    {
      orderNo: 'MO-202607-001',
      customerName: '林知夏',
      status: '已发货',
      createdAt: '2026-06-28 10:20',
      items: [makeLineItem('product-01', 2), makeLineItem('product-08', 1)],
    },
    {
      orderNo: 'MO-202607-002',
      customerName: '周以宁',
      status: '待发货',
      createdAt: '2026-06-29 14:05',
      items: [makeLineItem('product-03', 1), makeLineItem('product-13', 2)],
    },
    {
      orderNo: 'MO-202607-003',
      customerName: '苏沐晴',
      status: '已完成',
      createdAt: '2026-06-30 09:15',
      items: [makeLineItem('product-09', 1), makeLineItem('product-18', 1)],
    },
    {
      orderNo: 'MO-202607-004',
      customerName: '顾漫',
      status: '已完成',
      createdAt: '2026-07-01 18:40',
      items: [makeLineItem('product-04', 1), makeLineItem('product-19', 1), makeLineItem('product-12', 1)],
    },
  ];

  return orders.map((order) => ({
    ...order,
    totalPrice: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
  }));
}

