export function getSiteCopy() {
  return {
    brandName: '蓝笙织梦',
    slogan: '把海风、云光和二次元日常穿在身上',
    intro:
      '为喜欢轻盈、梦幻和少女感穿搭的人准备的服装小店。每一件都像从海边晴天里摘出来的灵感。',
    primaryCta: '浏览新品',
    secondaryCta: '查看风格',
    note: '轻互动展示页 · 暂无真实支付',
  };
}

export function getAuthCheckoutContract() {
  return {
    auth: {
      loginMethod: 'email-password',
      session: 'cookie-or-token',
    },
    user: {
      fields: ['email', 'password'],
    },
    address: {
      mode: 'single-default',
      fields: ['recipientName', 'phone', 'province', 'city', 'detail'],
      extensible: true,
    },
    order: {
      requiresAuth: true,
      requiresAddress: true,
    },
  };
}

export function getCollections() {
  return [
    {
      title: '学院风',
      summary: '整洁利落的日常感，适合通勤、约会和校园穿搭。',
      accent: '海盐蓝',
    },
    {
      title: '洛丽塔',
      summary: '蕾丝、蝴蝶结与层叠裙摆，强调精致和仪式感。',
      accent: '云雾白',
    },
    {
      title: '日常甜系',
      summary: '轻甜、柔软、好搭配，适合快速出门也能保持氛围感。',
      accent: '浅樱粉',
    },
  ];
}

export function getProducts() {
  return [
    {
      id: 'product-1',
      badge: '主推',
      name: '海盐蓝蝴蝶结连衣裙',
      category: '学院风',
      price: 269,
      sales: '1.2k',
      detail: '轻薄内衬 + 收腰版型，适合夏天做清爽感主角。',
    },
    {
      id: 'product-2',
      badge: '新品',
      name: '云朵感泡袖衬衫',
      category: '学院风',
      price: 189,
      sales: '860',
      detail: '肩线柔和、领口蓬松，单穿或叠穿都很出片。',
    },
    {
      id: 'product-3',
      badge: '热卖',
      name: '珍珠扣百褶短裙',
      category: '学院风',
      price: 159,
      sales: '2.4k',
      detail: '自带俏皮感的百搭裙型，适合搭配衬衫和针织。',
    },
    {
      id: 'product-4',
      badge: '限定',
      name: '薄纱蕾丝梦境裙',
      category: '洛丽塔',
      price: 399,
      sales: '530',
      detail: '层叠薄纱和细节蕾丝，营造轻盈的故事感。',
    },
    {
      id: 'product-5',
      badge: '推荐',
      name: '星月丝带连帽斗篷',
      category: '洛丽塔',
      price: 329,
      sales: '1.6k',
      detail: '适合做造型外搭，柔雾感很强，镜头里会很亮眼。',
    },
    {
      id: 'product-6',
      badge: '新色',
      name: '草莓奶泡针织开衫',
      category: '日常甜系',
      price: 219,
      sales: '940',
      detail: '柔软亲肤，春秋单穿都合适，颜色很显气色。',
    },
    {
      id: 'product-7',
      badge: '人气',
      name: '蝴蝶结松紧吊带上衣',
      category: '日常甜系',
      price: 149,
      sales: '1.1k',
      detail: '轻松搭出甜而不腻的氛围，适合和半裙组套。',
    },
    {
      id: 'product-8',
      badge: '搭配',
      name: '薄荷云感半身裙',
      category: '日常甜系',
      price: 179,
      sales: '780',
      detail: '裙摆有自然垂坠感，走动时会有很轻的流动感。',
    },
  ];
}
