import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Edit,
  Folder,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { deleteSource, importSource, listSources, rescanSource, updateSource } from '../api';
import { AddSourceDialog } from '../components/AddSourceDialog';
import { EditSourceDialog } from '../components/EditSourceDialog';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { formatDateTime } from '../lib/format';
import { readErrorMessage } from '../lib/errors';
import { isSourceDisconnected } from '../lib/sources';
import type { LibrarySourceStats } from '../../shared/types';

export function SourcesPage(): React.JSX.Element {
  const [sources, setSources] = useState<LibrarySourceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LibrarySourceStats | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSources(await listSources());
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAddSource(data: {
    name: string;
    path: string;
    isMonitoring: boolean;
  }): Promise<void> {
    setSubmitting(true);
    try {
      const result = await importSource(data.path, data.name, data.isMonitoring);
      toast.success('素材来源已导入', {
        description: `新增 ${result.indexed} 个素材，跳过 ${result.skipped} 个`
      });
      await refresh();
    } catch (error) {
      toast.error(readErrorMessage(error));
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSource(data: {
    name: string;
    rootPath: string;
    incrementalScanEnabled: boolean;
  }): Promise<void> {
    if (!editingSource) return;

    setSubmitting(true);
    try {
      await updateSource(editingSource.id, data);
      toast.success('素材来源已更新');
      setEditingSource(null);
      await refresh();
    } catch (error) {
      toast.error(readErrorMessage(error));
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRescan(source: LibrarySourceStats): Promise<void> {
    setBusySourceId(source.id);
    try {
      const result = await rescanSource(source.id);
      toast.success('重新扫描完成', {
        description: `新增 ${result.indexed} 个素材，跳过 ${result.skipped} 个`
      });
      await refresh();
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleToggleIncrementalScan(
    source: LibrarySourceStats,
    incrementalScanEnabled: boolean
  ): Promise<void> {
    setBusySourceId(source.id);
    try {
      await updateSource(source.id, { incrementalScanEnabled });
      setSources((current) =>
        current.map((item) => (item.id === source.id ? { ...item, incrementalScanEnabled } : item))
      );
      toast.success(incrementalScanEnabled ? '已开启监听变化' : '已关闭监听变化');
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleDelete(source: LibrarySourceStats): Promise<void> {
    if (!window.confirm(`确定删除来源「${source.name}」？关联素材将一并移除。`)) {
      return;
    }

    setBusySourceId(source.id);
    try {
      await deleteSource(source.id);
      toast.success('素材来源已删除');
      await refresh();
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setBusySourceId(null);
    }
  }

  function openEditDialog(source: LibrarySourceStats): void {
    setEditingSource(source);
    setEditDialogOpen(true);
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      <PageHeader
        title="导入来源"
        description="管理本地目录和外置硬盘素材来源"
        actions={
          <Button className="bg-[#4a6fa5] hover:bg-[#3d5a8a]" onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4 mr-2" />
            添加目录
          </Button>
        }
      />

      <AddSourceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onConfirm={handleAddSource}
        submitting={submitting}
      />

      <EditSourceDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingSource(null);
        }}
        source={editingSource}
        onConfirm={handleEditSource}
        submitting={submitting}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl space-y-4">
          {loading ? (
            <Card className="p-8 text-center text-sm text-gray-600">加载来源列表…</Card>
          ) : (
            sources.map((source) => {
              const disconnected = isSourceDisconnected(source);
              const busy = busySourceId === source.id;

              return (
                <Card key={source.id} className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${disconnected ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      {disconnected ? (
                        <AlertCircle className="size-6 text-amber-600" />
                      ) : (
                        <Folder className="size-6 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{source.name}</h3>
                          <p className="text-sm text-gray-600 mt-1 font-mono break-all">{source.rootPath}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => openEditDialog(source)}>
                            <Edit className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void handleDelete(source)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">文件数量:</span>
                          <Badge variant="outline">{source.assetCount} 个</Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">最后扫描:</span>
                          <span className="text-sm text-gray-900">{formatDateTime(source.lastScannedAt)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">监听变化:</span>
                          <Switch
                            checked={source.incrementalScanEnabled}
                            disabled={busy}
                            onCheckedChange={(checked) =>
                              void handleToggleIncrementalScan(source, checked)
                            }
                          />
                        </div>
                      </div>

                      {disconnected ? (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                          <AlertCircle className="size-5 text-amber-600 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-amber-900">移动硬盘已断开</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              请重新连接硬盘后点击「重新扫描」
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleRescan(source)}
                          >
                            <RefreshCw className={`size-4 mr-2 ${busy ? 'animate-spin' : ''}`} />
                            {busy ? '扫描中…' : '重新扫描'}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-4 flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleRescan(source)}
                          >
                            <RefreshCw className={`size-4 mr-2 ${busy ? 'animate-spin' : ''}`} />
                            {busy ? '扫描中…' : '重新扫描'}
                          </Button>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle className="size-4 text-green-600" />
                            <span>连接正常</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}

          <Card className="p-8 border-2 border-dashed">
            <div className="text-center">
              <Folder className="size-12 mx-auto text-gray-400 mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">添加新的素材来源</h3>
              <p className="text-sm text-gray-600 mb-4">
                支持本地目录和外置硬盘，系统会自动扫描并解析媒体文件
              </p>
              <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                <Plus className="size-4 mr-2" />
                选择目录
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
