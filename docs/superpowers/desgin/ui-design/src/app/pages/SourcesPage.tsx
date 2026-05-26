import { useState } from 'react';
import { Folder, Plus, RefreshCw, AlertCircle, CheckCircle, Trash2, Edit } from 'lucide-react';
import { mockSources } from '../mock-data';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { AddSourceDialog } from '../components/AddSourceDialog';
import { EditSourceDialog } from '../components/EditSourceDialog';
import { LibrarySource } from '../types';
import { toast } from 'sonner';

export function SourcesPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LibrarySource | null>(null);

  const handleAddSource = (data: { name: string; path: string; isMonitoring: boolean }) => {
    console.log('添加来源:', data);
    toast.success('素材来源已添加', {
      description: `${data.name} - ${data.path}`,
    });
  };

  const handleEditSource = (data: { name: string; path: string; isMonitoring: boolean }) => {
    console.log('编辑来源:', data);
    toast.success('素材来源已更新');
    setEditingSource(null);
  };

  const openEditDialog = (source: LibrarySource) => {
    setEditingSource(source);
    setEditDialogOpen(true);
  };
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">导入来源</h1>
            <p className="text-sm text-gray-600 mt-1">管理本地目录和外置硬盘素材来源</p>
          </div>
          <Button className="bg-[#4a6fa5] hover:bg-[#3d5a8a]" onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4 mr-2" />
            添加目录
          </Button>
        </div>
      </div>

      <AddSourceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onConfirm={handleAddSource}
      />

      <EditSourceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        source={editingSource}
        onConfirm={handleEditSource}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl space-y-4">
          {mockSources.map((source) => {
            const isDisconnected = !source.isMonitoring && source.path.includes('External');

            return (
              <Card key={source.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${isDisconnected ? 'bg-amber-100' : 'bg-blue-100'}`}>
                    {isDisconnected ? (
                      <AlertCircle className="size-6 text-amber-600" />
                    ) : (
                      <Folder className="size-6 text-blue-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{source.name}</h3>
                        <p className="text-sm text-gray-600 mt-1 font-mono">{source.path}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(source)}>
                          <Edit className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">文件数量:</span>
                        <Badge variant="outline">{source.assetCount} 个</Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">最后扫描:</span>
                        <span className="text-sm text-gray-900">
                          {source.lastScanned ? formatDate(source.lastScanned) : '从未'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">监听变化:</span>
                        <Switch checked={source.isMonitoring} />
                      </div>
                    </div>

                    {isDisconnected && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="size-5 text-amber-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">移动硬盘已断开</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            请重新连接硬盘后点击"重新扫描"
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          <RefreshCw className="size-4 mr-2" />
                          重新扫描
                        </Button>
                      </div>
                    )}

                    {!isDisconnected && (
                      <div className="mt-4 flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <RefreshCw className="size-4 mr-2" />
                          重新扫描
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
          })}

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
