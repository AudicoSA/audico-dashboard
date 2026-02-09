export const mockOpenCartProducts = [
  {
    product_id: 1,
    model: 'LED-001',
    sku: 'LED-SMART-001',
    price: 29.99,
    quantity: 100,
    status: 1,
    image: 'catalog/products/led-bulb.jpg',
    date_added: new Date(),
    date_modified: new Date()
  },
  {
    product_id: 2,
    model: 'LOCK-001',
    sku: 'LOCK-SMART-001',
    price: 149.99,
    quantity: 50,
    status: 1,
    image: 'catalog/products/door-lock.jpg',
    date_added: new Date(),
    date_modified: new Date()
  },
  {
    product_id: 3,
    model: 'CAM-001',
    sku: 'CAM-SECURITY-001',
    price: 89.99,
    quantity: 75,
    status: 1,
    image: '',
    date_added: new Date(),
    date_modified: new Date()
  }
]

export const mockOpenCartProductDescriptions = [
  {
    product_id: 1,
    language_id: 1,
    name: 'Smart LED Light Bulb',
    description: 'Wi-Fi enabled LED bulb',
    meta_title: '',
    meta_description: '',
    meta_keyword: '',
    tag: ''
  },
  {
    product_id: 2,
    language_id: 1,
    name: 'Smart Door Lock',
    description: 'Keyless entry smart lock with remote access and auto-lock features. Easy to install and compatible with all standard doors.',
    meta_title: 'Smart Door Lock - Keyless Entry',
    meta_description: 'Secure your home with our smart door lock featuring keyless entry and remote access.',
    meta_keyword: 'smart lock, keyless entry, home security',
    tag: 'security,smart home,lock'
  },
  {
    product_id: 3,
    language_id: 1,
    name: 'Security Camera HD',
    description: 'High-definition security camera with night vision and motion detection capabilities.',
    meta_title: 'HD Security Camera with Night Vision',
    meta_description: 'Monitor your property with our HD security camera featuring night vision and motion detection.',
    meta_keyword: 'security camera, HD camera, night vision',
    tag: 'security,camera,surveillance'
  }
]

export const mockOpenCartProductImages = [
  {
    product_image_id: 1,
    product_id: 2,
    image: 'catalog/products/door-lock-angle1.jpg',
    sort_order: 1
  },
  {
    product_image_id: 2,
    product_id: 2,
    image: 'catalog/products/door-lock-angle2.jpg',
    sort_order: 2
  },
  {
    product_image_id: 3,
    product_id: 2,
    image: 'catalog/products/door-lock-detail.jpg',
    sort_order: 3
  }
]

export const mockSEOAuditResults = [
  {
    product_id: 1,
    product_name: 'Smart LED Light Bulb',
    sku: 'LED-SMART-001',
    score: 35,
    issues: [
      {
        type: 'short_description',
        severity: 'high' as const,
        field: 'description',
        message: 'Product description is too short or missing',
        current_value: 'Wi-Fi enabled LED bulb'
      },
      {
        type: 'missing_meta_title',
        severity: 'high' as const,
        field: 'meta_title',
        message: 'Meta title is missing'
      },
      {
        type: 'missing_meta_description',
        severity: 'high' as const,
        field: 'meta_description',
        message: 'Meta description is missing'
      }
    ],
    recommendations: [
      {
        type: 'content',
        priority: 'high' as const,
        action: 'Expand product description',
        details: 'Write a detailed description of at least 200 words with relevant keywords'
      },
      {
        type: 'seo',
        priority: 'high' as const,
        action: 'Add meta title',
        details: 'Create an engaging meta title (50-60 characters) with primary keywords'
      }
    ]
  },
  {
    product_id: 3,
    product_name: 'Security Camera HD',
    sku: 'CAM-SECURITY-001',
    score: 60,
    issues: [
      {
        type: 'missing_main_image',
        severity: 'critical' as const,
        field: 'image',
        message: 'Product has no main image'
      },
      {
        type: 'no_additional_images',
        severity: 'medium' as const,
        field: 'product_images',
        message: 'Product has no additional images'
      }
    ],
    recommendations: [
      {
        type: 'media',
        priority: 'high' as const,
        action: 'Add main product image',
        details: 'Upload a high-quality main product image (at least 800x800px)'
      }
    ]
  }
]
