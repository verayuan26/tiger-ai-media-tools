import { useState } from 'react';
import { Plus, Sparkles, Merge, Edit, Trash2, Tag, Folder } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { AddThemeDialog } from '../components/AddThemeDialog';
import { AddTagDialog } from '../components/AddTagDialog';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

interface Theme {
  id: string;
  name: string;
  assetCount: number;
  isAiRecommended: boolean;
}

interface TagData {
  id: string;
  name: string;
  normalizedName: string;
  source: 'ai' | 'user' | 'system';
  confidence?: number;
  assetCount: number;
  synonyms?: string[];
}

const mockThemes: Theme[] = [
  { id: '1', name: '牛仔面料工厂', assetCount: 156, isAiRecommended: false },
  { id: '2', name: '产品册', assetCount: 42, isAiRecommended: false },
  { id: '3', name: '车间访谈', assetCount: 28, isAiRecommended: false },
  { id: '4', name: '样布记录', assetCount: 19, isAiRecommended: false },
  { id: '5', name: '质量检查流程', assetCount: 15, isAiRecommended: true },
  { id: '6', name: '面料样本', assetCount: 23, isAiRecommended: true },
];

const mockTags: TagData[] = [
  {
    id: 't1',
    name: '牛仔布',
    normalizedName: '牛仔布',
    source: 'ai',
    confidence: 0.92,
    assetCount: 89,
    synonyms: ['denim fabric', 'denim'],
  },
  {
    id: 't2',
    name: '缝纫机',
    normalizedName: '缝纫机',
    source: 'ai',
    confidence: 0.95,
    assetCount: 67,
  },
  {
    id: 't3',
    name: '裁剪布料',
    normalizedName: '裁剪布料',
    source: 'ai',
    confidence: 0.88,
    assetCount: 54,
  },
  {
    id: 't4',
    name: '工人操作',
    normalizedName: '工人操作',
    source: 'ai',
    confidence: 0.91,
    assetCount: 72,
  },
  {
    id: 't5',
    name: '产品册',
    normalizedName: '产品册',
    source: 'ai',
    confidence: 0.89,
    assetCount: 34,
  },
  {
    id: 't6',
    name: '重点素材',
    normalizedName: '重点素材',
    source: 'user',
    assetCount: 12,
  },
];

export function TagsPage() {
  const [addThemeDialogOpen, setAddThemeDialogOpen] = useState(false);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);

  const manualThemes = mockThemes.filter(t => !t.isAiRecommended);
  const aiThemes = mockThemes.filter(t => t.isAiRecommended);

  const handleAddTheme = (data: { name: string; description: string }) => {
    console.log('新建主题:', data);
    toast.success('主题已创建', {
      description: data.name,
    });
  };

  const handleAddTag = (data: { name: string; normalizedName: string; synonyms: string[] }) => {
    console.log('添加标签:', data);
    toast.success('标签已添加', {
      description: data.name,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">标签与主题管理</h1>
            <p className="text-sm text-gray-600 mt-1">管理素材分类、标签归并和同义词</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl grid grid-cols-3 gap-6">
          {/* Left: Themes */}
          <div className="col-span-1 space-y-6">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">主题集合</h2>
                <Button size="sm" onClick={() => setAddThemeDialogOpen(true)}>
                  <Plus className="size-4 mr-1" />
                  新建
                </Button>
              </div>

              <AddThemeDialog
                open={addThemeDialogOpen}
                onOpenChange={setAddThemeDialogOpen}
                onConfirm={handleAddTheme}
              />

              <div className="space-y-2">
                {manualThemes.map((theme) => (
                  <button
                    key={theme.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="size-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">{theme.name}</span>
                    </div>
                    <Badge variant="outline">{theme.assetCount}</Badge>
                  </button>
                ))}
              </div>
            </Card>

            {aiThemes.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="size-4 text-purple-600" />
                  <h2 className="font-semibold text-gray-900">AI 推荐主题</h2>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  需要确认后归类到主题集合
                </p>

                <div className="space-y-2">
                  {aiThemes.map((theme) => (
                    <div
                      key={theme.id}
                      className="p-3 rounded-lg border border-purple-200 bg-purple-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{theme.name}</span>
                        <Badge variant="outline" className="bg-white">{theme.assetCount}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                          确认
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          忽略
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Tags Table */}
          <div className="col-span-2">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">标签管理</h2>
                <div className="flex gap-2">
                  <Input placeholder="搜索标签..." className="w-64" />
                  <Button size="sm" onClick={() => setAddTagDialogOpen(true)}>
                    <Plus className="size-4 mr-1" />
                    添加标签
                  </Button>
                </div>
              </div>

              <AddTagDialog
                open={addTagDialogOpen}
                onOpenChange={setAddTagDialogOpen}
                onConfirm={handleAddTag}
              />

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标签名</TableHead>
                      <TableHead>标准化名称</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>置信度</TableHead>
                      <TableHead>关联素材</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{tag.name}</div>
                            {tag.synonyms && (
                              <div className="flex gap-1 mt-1">
                                {tag.synonyms.map((syn, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {syn}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">{tag.normalizedName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={tag.source === 'ai' ? 'default' : tag.source === 'user' ? 'secondary' : 'outline'}
                          >
                            {tag.source === 'ai' ? 'AI' : tag.source === 'user' ? '用户' : '系统'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tag.confidence ? (
                            <span className="text-sm text-gray-600">
                              {Math.round(tag.confidence * 100)}%
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tag.assetCount} 个</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost">
                              <Merge className="size-3" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Edit className="size-3" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-1">同义词归并</p>
                <p className="text-sm text-blue-800">
                  系统会自动将相似标签（如"牛仔布"、"denim fabric"、"denim"）归并到同一标签组，
                  减少重复标签并提高搜索准确性。
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
