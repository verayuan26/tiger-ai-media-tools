import { Pause, Play, RotateCw, AlertCircle, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { mockAssets } from '../mock-data';

interface TaskItem {
  id: string;
  assetName: string;
  fileType: 'video' | 'image' | 'audio';
  stage: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress: number;
  error?: string;
  retryCount?: number;
}

const mockTasks: TaskItem[] = [
  {
    id: '1',
    assetName: 'ironing-fabric.mp4',
    fileType: 'video',
    stage: 'AI 视觉识别',
    status: 'processing',
    progress: 65,
  },
  {
    id: '2',
    assetName: 'new-sample-01.jpg',
    fileType: 'image',
    stage: '读取元数据',
    status: 'processing',
    progress: 30,
  },
  {
    id: '3',
    assetName: 'worker-interview-02.mp4',
    fileType: 'video',
    stage: '视频抽帧',
    status: 'pending',
    progress: 0,
  },
  {
    id: '4',
    assetName: 'factory-tour.mp4',
    fileType: 'video',
    stage: '语音识别',
    status: 'pending',
    progress: 0,
  },
  {
    id: '5',
    assetName: 'corrupted-file.mp4',
    fileType: 'video',
    stage: '生成缩略图',
    status: 'failed',
    progress: 0,
    error: 'ffmpeg 处理失败：视频文件已损坏',
    retryCount: 2,
  },
  {
    id: '6',
    assetName: 'missing-file.jpg',
    fileType: 'image',
    stage: '读取元数据',
    status: 'failed',
    progress: 0,
    error: '文件不存在：移动硬盘已断开',
    retryCount: 1,
  },
];

export function TaskQueuePage() {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const stats = {
    processing: mockTasks.filter(t => t.status === 'processing').length,
    pending: mockTasks.filter(t => t.status === 'pending').length,
    failed: mockTasks.filter(t => t.status === 'failed').length,
    done: 234,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="size-5 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="size-5 text-gray-400" />;
      case 'done':
        return <CheckCircle className="size-5 text-green-600" />;
      case 'failed':
        return <XCircle className="size-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      processing: { label: '处理中', className: 'bg-blue-100 text-blue-700' },
      pending: { label: '等待中', className: 'bg-gray-100 text-gray-700' },
      done: { label: '已完成', className: 'bg-green-100 text-green-700' },
      failed: { label: '失败', className: 'bg-red-100 text-red-700' },
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">任务队列</h1>
            <p className="text-sm text-gray-600 mt-1">管理后台解析任务和错误处理</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Pause className="size-4 mr-2" />
              暂停队列
            </Button>
            <Button variant="outline">
              <RotateCw className="size-4 mr-2" />
              批量重试
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">处理中</p>
                  <p className="text-2xl font-semibold text-blue-600 mt-1">{stats.processing}</p>
                </div>
                <Loader2 className="size-8 text-blue-600 animate-spin opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">等待中</p>
                  <p className="text-2xl font-semibold text-gray-600 mt-1">{stats.pending}</p>
                </div>
                <Clock className="size-8 text-gray-400 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">已完成</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">{stats.done}</p>
                </div>
                <CheckCircle className="size-8 text-green-600 opacity-50" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">失败</p>
                  <p className="text-2xl font-semibold text-red-600 mt-1">{stats.failed}</p>
                </div>
                <XCircle className="size-8 text-red-600 opacity-50" />
              </div>
            </Card>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {mockTasks.map((task) => (
              <Card key={task.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getStatusIcon(task.status)}</div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{task.assetName}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {task.stage} • {task.fileType === 'video' ? '视频' : task.fileType === 'image' ? '图片' : '音频'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusBadge(task.status)}
                        {task.status === 'failed' && (
                          <Button size="sm" variant="outline">
                            <RotateCw className="size-3 mr-1" />
                            重试
                          </Button>
                        )}
                      </div>
                    </div>

                    {task.status === 'processing' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">进度</span>
                          <span className="text-sm font-medium text-gray-900">{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="h-2" />
                      </div>
                    )}

                    {task.status === 'failed' && (
                      <div className="mt-3">
                        <button
                          onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                        >
                          <AlertCircle className="size-4" />
                          <span>查看错误详情</span>
                        </button>

                        {expandedTask === task.id && (
                          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-medium text-red-900 mb-2">错误信息</p>
                            <p className="text-sm text-red-800 font-mono">{task.error}</p>
                            {task.retryCount && task.retryCount > 0 && (
                              <p className="text-xs text-red-700 mt-2">
                                已重试 {task.retryCount} 次
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
