const COLLECTIONS = [
  {
    title: '鞋子',
    summary: '从玛丽珍到高跟鞋，突出脚部轮廓和穿搭完成度。',
    accent: '海盐蓝',
  },
  {
    title: '帽子',
    summary: '贝雷帽、礼帽和宽檐帽，让整体造型更完整。',
    accent: '云雾白',
  },
  {
    title: '丝袜',
    summary: '连裤袜、长筒袜和过膝袜，强调腿部线条和质感。',
    accent: '烟灰黑',
  },
  {
    title: '连衣裙',
    summary: '收腰、褶皱、泡泡袖，适合轻甜感穿搭展示。',
    accent: '浅樱粉',
  },
  {
    title: '上衣',
    summary: '短上衣和针织衫，适合日常搭配和层次感展示。',
    accent: '奶油白',
  },
  {
    title: '短裙',
    summary: '百褶、高腰、轻纱款式，突出灵动感和腿部比例。',
    accent: '薄雾紫',
  },
  {
    title: '首饰',
    summary: '耳饰、项链和指环等小配件，细节感更强。',
    accent: '珍珠金',
  },
  {
    title: '头饰',
    summary: '发夹、发箍和蝴蝶结，让脸部附近更有记忆点。',
    accent: '奶蓝',
  },
  {
    title: '包包',
    summary: '迷你手提包和斜挎包，补足整套穿搭的完整度。',
    accent: '云朵灰',
  },
];

const PRODUCT_DEFINITIONS = [
  {
    id: 'product-01',
    badge: '主推',
    name: '海盐蝴蝶结玛丽珍鞋',
    category: '鞋子',
    price: 299,
    sales: '3.6k',
    detailLayout: 'split',
    purchaseLayout: 'buy',
    imageFit: 'contain',
    detail: '黑色漆皮与蝴蝶结搭扣组合，脚背线条和鞋面弧度都很清楚。',
  },
  {
    id: 'product-02',
    badge: '新品',
    name: '云雾珍珠绑带凉鞋',
    category: '鞋子',
    price: 289,
    sales: '3.3k',
    imageFit: 'contain',
    detail: '轻薄绑带搭配珍珠细节，适合夏季清爽感展示。',
  },
  {
    id: 'product-03',
    badge: '热卖',
    name: '薄荷浅口单鞋',
    category: '鞋子',
    price: 279,
    sales: '3.1k',
    imageFit: 'contain',
    detail: '浅口轮廓干净利落，能很好地突出脚部比例和鞋型。',
  },
  {
    id: 'product-04',
    badge: '限定',
    name: '夜色漆皮乐福鞋',
    category: '鞋子',
    price: 269,
    sales: '2.9k',
    imageFit: 'contain',
    detail: '偏通勤感的轮廓配上高光漆面，适合日常搭配风格。',
  },
  {
    id: 'product-05',
    badge: '推荐',
    name: '星月薄纱贝雷帽',
    category: '帽子',
    price: 239,
    sales: '2.6k',
    detail: '柔软帽身和轻薄帽檐让脸部轮廓更集中，也更显温柔。',
  },
  {
    id: 'product-06',
    badge: '新品',
    name: '珍珠缎带宽檐帽',
    category: '帽子',
    price: 219,
    sales: '2.4k',
    detail: '宽檐结构带出度假感，珍珠和缎带细节更偏轻甜风。',
  },
  {
    id: 'product-07',
    badge: '热卖',
    name: '云朵软呢礼帽',
    category: '帽子',
    price: 209,
    sales: '2.2k',
    detail: '软呢质感适合偏优雅的造型，能让头部配饰存在感更强。',
  },
  {
    id: 'product-08',
    badge: '人气',
    name: '细闪透明连裤袜',
    category: '丝袜',
    price: 199,
    sales: '2.05k',
    detail: '轻薄透肤感明显，能直接强调腿部线条和整体显长效果。',
  },
  {
    id: 'product-09',
    badge: '主推',
    name: '黑丝蝴蝶结长筒袜',
    category: '丝袜',
    price: 189,
    sales: '1.95k',
    detail: '深色袜面搭配蝴蝶结装饰，适合更强调腿部氛围感的图。',
  },
  {
    id: 'product-10',
    badge: '新品',
    name: '过膝网纱袜',
    category: '丝袜',
    price: 179,
    sales: '1.8k',
    detail: '网纱纹理更有层次，适合在全身图里做视觉焦点。',
  },
  {
    id: 'product-11',
    badge: '搭配',
    name: '奶白高弹打底袜',
    category: '丝袜',
    price: 169,
    sales: '1.7k',
    detail: '偏基础款的百搭袜型，适合和短裙或短裤一起展示。',
  },
  {
    id: 'product-12',
    badge: '限定',
    name: '海盐蓝A字连衣裙',
    category: '连衣裙',
    price: 359,
    sales: '1.6k',
    detail: '收腰和A字裙摆组合，适合做清爽感的整套穿搭展示。',
  },
  {
    id: 'product-13',
    badge: '推荐',
    name: '云朵褶皱泡泡袖裙',
    category: '连衣裙',
    price: 339,
    sales: '1.5k',
    detail: '肩部和袖口的体积感更明显，整体会更有轻盈少女感。',
  },
  {
    id: 'product-14',
    badge: '主推',
    name: '薄荷系收腰吊带裙',
    category: '连衣裙',
    price: 329,
    sales: '1.4k',
    detail: '吊带和收腰结构都比较清晰，适合突出上身和腰线比例。',
  },
  {
    id: 'product-15',
    badge: '新品',
    name: '奶油方领短上衣',
    category: '上衣',
    price: 219,
    sales: '1.3k',
    detail: '方领和短款版型很适合做日常穿搭的上半身展示。',
  },
  {
    id: 'product-16',
    badge: '热卖',
    name: '云朵泡泡袖针织衫',
    category: '上衣',
    price: 199,
    sales: '1.2k',
    detail: '针织质感更柔和，泡泡袖能让整体造型更有层次。',
  },
  {
    id: 'product-17',
    badge: '搭配',
    name: '轻纱百褶短裙',
    category: '短裙',
    price: 189,
    sales: '1.1k',
    detail: '短裙摆更轻快，适合和上衣或丝袜搭出完整造型。',
  },
  {
    id: 'product-18',
    badge: '精选',
    name: '珍珠星芒耳饰套装',
    category: '首饰',
    price: 129,
    sales: '980',
    detail: '耳饰细节小但存在感高，适合做脸部附近的点睛装饰。',
  },
  {
    id: 'product-19',
    badge: '主推',
    name: '蝴蝶结发夹礼盒',
    category: '头饰',
    price: 149,
    sales: '910',
    detail: '发夹和蝴蝶结元素很适合二次元风格，也方便统一角色感。',
  },
  {
    id: 'product-20',
    badge: '推荐',
    name: '海盐风迷你手提包',
    category: '包包',
    price: 259,
    sales: '840',
    detail: '小体积手提包适合与裙装、外套和鞋子一起做整套搭配。',
  },
];

function buildProduct(product) {
  return {
    ...product,
    image: `./assets/products/${product.id}.png`,
  };
}

export function getSiteCopy() {
  return {
    brandName: '蓝绡织梦',
    slogan: '把海风、云光和轻甜感都穿在身上。',
    intro: '为喜欢清透、梦幻和少女感穿搭的人准备的二次元风商品页。',
    primaryCta: '浏览新品',
    secondaryCta: '查看分类',
    note: '20 个商品 · 角色统一 · 参考图生成',
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
      mode: 'single-default',
      fields: ['recipientName', 'phone', 'province', 'city', 'detail'],
      extensible: true,
    },
    sidebar: {
      sections: ['account', 'address', 'orders'],
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
  };
}
