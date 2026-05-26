import { Asset, Collection, LibrarySource, AnalysisJob } from './types';

export const mockCollections: Collection[] = [
  {
    id: '1',
    name: '牛仔面料工厂',
    description: '工厂生产流程、设备、产品相关素材',
    assetCount: 156,
    isAiRecommended: false,
  },
  {
    id: '2',
    name: '产品展示',
    description: 'AI 推荐：包含产品册和展示相关内容',
    assetCount: 42,
    isAiRecommended: true,
  },
  {
    id: '3',
    name: '工厂环境',
    description: '车间、设备、工人操作场景',
    assetCount: 89,
    isAiRecommended: false,
  },
];

export const mockSources: LibrarySource[] = [
  {
    id: '1',
    path: '/Users/john/Documents/factory-footage',
    name: '工厂素材库',
    lastScanned: new Date('2026-05-25T10:30:00'),
    assetCount: 234,
    isMonitoring: true,
  },
  {
    id: '2',
    path: '/Volumes/External/archive-2025',
    name: '外置硬盘归档',
    lastScanned: new Date('2026-05-20T15:00:00'),
    assetCount: 567,
    isMonitoring: false,
  },
];

export const mockAssets: Asset[] = [
  {
    id: '1',
    path: '/Users/john/Documents/factory-footage/sewing-process.mp4',
    fileName: 'sewing-process.mp4',
    fileType: 'video',
    size: 524288000,
    duration: 312,
    thumbnailUrl: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=400',
    status: 'done',
    tags: [
      { id: 't1', name: '缝纫机', type: 'ai', confidence: 0.95 },
      { id: 't2', name: '牛仔布', type: 'ai', confidence: 0.88 },
      { id: 't3', name: '工人操作', type: 'ai', confidence: 0.92 },
      { id: 't4', name: '俄文', type: 'system' },
      { id: 't5', name: '有字幕', type: 'system' },
    ],
    frames: [
      {
        id: 'f1',
        timestamp: 15,
        thumbnailUrl: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=200',
        tags: [{ id: 't1', name: '缝纫机', type: 'ai', confidence: 0.95 }],
      },
      {
        id: 'f2',
        timestamp: 45,
        thumbnailUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea3c8565?w=200',
        tags: [{ id: 't2', name: '牛仔布', type: 'ai', confidence: 0.88 }],
      },
    ],
    transcripts: [
      {
        id: 'tr1',
        startTime: 10,
        endTime: 25,
        language: 'ru',
        text: 'Мы используем высококачественную джинсовую ткань',
        translation: '我们使用高质量的牛仔布料',
      },
    ],
    createdAt: new Date('2026-05-20T09:00:00'),
    modifiedAt: new Date('2026-05-20T09:00:00'),
  },
  {
    id: '2',
    path: '/Users/john/Documents/factory-footage/cutting-denim.mp4',
    fileName: 'cutting-denim.mp4',
    fileType: 'video',
    size: 418000000,
    duration: 245,
    thumbnailUrl: 'https://images.unsplash.com/photo-1565084888279-aca607ecce2c?w=400',
    status: 'done',
    tags: [
      { id: 't6', name: '裁剪布料', type: 'ai', confidence: 0.91 },
      { id: 't2', name: '牛仔布', type: 'ai', confidence: 0.94 },
      { id: 't7', name: '英文', type: 'system' },
    ],
    createdAt: new Date('2026-05-19T14:30:00'),
    modifiedAt: new Date('2026-05-19T14:30:00'),
  },
  {
    id: '3',
    path: '/Users/john/Documents/factory-footage/product-catalog-01.jpg',
    fileName: 'product-catalog-01.jpg',
    fileType: 'image',
    size: 3200000,
    thumbnailUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
    status: 'done',
    tags: [
      { id: 't8', name: '产品册', type: 'ai', confidence: 0.89 },
      { id: 't9', name: '牛仔裤', type: 'ai', confidence: 0.96 },
    ],
    createdAt: new Date('2026-05-18T11:00:00'),
    modifiedAt: new Date('2026-05-18T11:00:00'),
  },
  {
    id: '4',
    path: '/Users/john/Documents/factory-footage/ironing-fabric.mp4',
    fileName: 'ironing-fabric.mp4',
    fileType: 'video',
    size: 290000000,
    duration: 178,
    thumbnailUrl: 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=400',
    status: 'processing',
    tags: [
      { id: 't10', name: '熨烫面料', type: 'ai', confidence: 0.87 },
    ],
    createdAt: new Date('2026-05-26T08:15:00'),
    modifiedAt: new Date('2026-05-26T08:15:00'),
  },
  {
    id: '5',
    path: '/Users/john/Documents/factory-footage/factory-overview.jpg',
    fileName: 'factory-overview.jpg',
    fileType: 'image',
    size: 4100000,
    thumbnailUrl: 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=400',
    status: 'done',
    tags: [
      { id: 't11', name: '工厂车间', type: 'ai', confidence: 0.93 },
      { id: 't12', name: '缝纫设备', type: 'ai', confidence: 0.85 },
    ],
    createdAt: new Date('2026-05-17T16:20:00'),
    modifiedAt: new Date('2026-05-17T16:20:00'),
  },
  {
    id: '6',
    path: '/Users/john/Documents/factory-footage/quality-check.mp4',
    fileName: 'quality-check.mp4',
    fileType: 'video',
    size: 380000000,
    duration: 210,
    thumbnailUrl: 'https://images.unsplash.com/photo-1529720317453-c8da503f2051?w=400',
    status: 'done',
    tags: [
      { id: 't13', name: '质量检查', type: 'ai', confidence: 0.90 },
      { id: 't3', name: '工人操作', type: 'ai', confidence: 0.88 },
      { id: 't14', name: '中文', type: 'system' },
      { id: 't5', name: '有字幕', type: 'system' },
    ],
    createdAt: new Date('2026-05-21T13:45:00'),
    modifiedAt: new Date('2026-05-21T13:45:00'),
  },
];

export const mockJobs: AnalysisJob[] = [
  {
    id: 'j1',
    assetId: '4',
    stage: 'AI标签识别',
    status: 'processing',
    progress: 65,
  },
  {
    id: 'j2',
    assetId: '7',
    stage: '视频抽帧',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'j3',
    assetId: '8',
    stage: '语音识别',
    status: 'pending',
    progress: 0,
  },
];
