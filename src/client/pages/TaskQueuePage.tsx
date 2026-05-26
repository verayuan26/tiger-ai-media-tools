import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  RotateCw,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  drainJobs,
  getQueueSummary,
  listQueueJobs,
  retryFailed
} from '../api';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { readErrorMessage } from '../lib/errors';
import { mediaKindLabels, stageLabels, stageProgress, statusLabels } from '../lib/job-labels';
import type { QueueJobListItem, QueueSummary } from '../../shared/types';

export function TaskQueuePage(): React.JSX.Element {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [jobs, setJobs] = useState<QueueJobListItem[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSummary, nextJobs] = await Promise.all([getQueueSummary(), listQueueJobs()]);
      setSummary(nextSummary);
      setJobs(nextJobs);
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAction(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      <PageHeader
        title="任务队列"
        description="管理后台解析任务和错误处理"
        actions={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void runAction(async () => {
                  const result = await drainJobs(10);
                  if (result.blocked) {
                    toast.warning(result.blocked.message, {
                      description: result.processed > 0 ? `已处理 ${result.processed} 个任务后停止` : undefined
                    });
                    return;
                  }
                  toast.success(`已处理 ${result.processed} 个任务`);
                })
              }
            >
              <Loader2 className="size-4 mr-2" />
              处理队列
            </Button>
            <Button
              variant="outline"
              disabled={busy || !summary?.failed}
              onClick={() =>
                void runAction(async () => {
                  const result = await retryFailed();
                  toast.success(`已重试 ${result.changed} 个失败任务`);
                })
              }
            >
              <RotateCw className="size-4 mr-2" />
              批量重试
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="处理中" value={summary?.processing ?? 0} icon={<Loader2 className="size-8 text-blue-600 animate-spin opacity-50" />} valueClass="text-blue-600" />
            <StatCard label="等待中" value={summary?.pending ?? 0} icon={<Clock className="size-8 text-gray-400 opacity-50" />} valueClass="text-gray-600" />
            <StatCard label="已完成" value={summary?.done ?? 0} icon={<CheckCircle className="size-8 text-green-600 opacity-50" />} valueClass="text-green-600" />
            <StatCard label="失败" value={summary?.failed ?? 0} icon={<XCircle className="size-8 text-red-600 opacity-50" />} valueClass="text-red-600" />
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-gray-600">加载任务列表…</Card>
          ) : jobs.length === 0 ? (
            <Card className="p-8 text-center text-sm text-gray-600">当前没有待处理或失败的任务</Card>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <Card key={job.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{statusIcon(job.status)}</div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{job.fileName}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {stageLabels[job.stage]} • {mediaKindLabels[job.kind]}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge className={statusBadgeClass(job.status)}>{statusLabels[job.status]}</Badge>
                          {job.status === 'failed' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void runAction(async () => {
                                  await retryFailed(job.assetId);
                                  toast.success('已重新排队该素材的失败任务');
                                })
                              }
                            >
                              <RotateCw className="size-3 mr-1" />
                              重试
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {job.status === 'processing' ? (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">进度</span>
                            <span className="text-sm font-medium text-gray-900">{stageProgress(job.stage)}%</span>
                          </div>
                          <Progress value={stageProgress(job.stage)} className="h-2" />
                        </div>
                      ) : null}

                      {job.status === 'failed' && job.errorMessage ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setExpandedJobId((current) => (current === job.id ? null : job.id))}
                            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                          >
                            <AlertCircle className="size-4" />
                            <span>查看错误详情</span>
                          </button>

                          {expandedJobId === job.id ? (
                            <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm font-medium text-red-900 mb-2">错误信息</p>
                              <p className="text-sm text-red-800 font-mono whitespace-pre-wrap">{job.errorMessage}</p>
                              {job.attempts > 0 ? (
                                <p className="text-xs text-red-700 mt-2">已尝试 {job.attempts} 次</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueClass
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClass: string;
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`text-2xl font-semibold mt-1 ${valueClass}`}>{value}</p>
        </div>
        {icon}
      </div>
    </Card>
  );
}

function statusIcon(status: QueueJobListItem['status']): React.ReactNode {
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
      return <Clock className="size-5 text-gray-400" />;
  }
}

function statusBadgeClass(status: QueueJobListItem['status']): string {
  switch (status) {
    case 'processing':
      return 'bg-blue-100 text-blue-700';
    case 'pending':
      return 'bg-gray-100 text-gray-700';
    case 'done':
      return 'bg-green-100 text-green-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
