import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit, Folder, Merge, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createTag, importSource, listSources, listTags } from '../api';
import { AddSourceDialog } from '../components/AddSourceDialog';
import { AddTagDialog, type AddTagFormData } from '../components/AddTagDialog';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import { readErrorMessage } from '../lib/errors';
import type { LibrarySourceStats, TagListItem } from '../../shared/types';

function groupSynonyms(tags: TagListItem[]): Map<string, string[]> {
  const groups = new Map<string, TagListItem[]>();

  for (const tag of tags) {
    const key = tag.normalizedName.toLowerCase();
    const bucket = groups.get(key) ?? [];
    bucket.push(tag);
    groups.set(key, bucket);
  }

  const synonyms = new Map<string, string[]>();
  for (const tag of tags) {
    const siblings = groups.get(tag.normalizedName.toLowerCase()) ?? [];
    const related = siblings
      .filter((item) => item.id !== tag.id && item.displayName !== tag.displayName)
      .map((item) => item.displayName);
    if (related.length > 0) {
      synonyms.set(tag.id, related);
    }
  }

  return synonyms;
}

export function TagsPage(): React.JSX.Element {
  const [tags, setTags] = useState<TagListItem[]>([]);
  const [sources, setSources] = useState<LibrarySourceStats[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addThemeDialogOpen, setAddThemeDialogOpen] = useState(false);
  const [submittingTag, setSubmittingTag] = useState(false);
  const [submittingTheme, setSubmittingTheme] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTags, nextSources] = await Promise.all([listTags(), listSources()]);
      setTags(nextTags);
      setSources(nextSources);
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTags = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return tags;

    return tags.filter(
      (tag) =>
        tag.displayName.toLowerCase().includes(keyword) ||
        tag.normalizedName.toLowerCase().includes(keyword)
    );
  }, [query, tags]);

  const synonymMap = useMemo(() => groupSynonyms(tags), [tags]);

  const aiRecommendedTags = useMemo(
    () =>
      tags
        .filter((tag) => tag.source === 'ai' && tag.assetCount > 0)
        .sort((left, right) => right.assetCount - left.assetCount)
        .slice(0, 6),
    [tags]
  );

  async function handleAddTag(data: AddTagFormData): Promise<void> {
    setSubmittingTag(true);
    try {
      await createTag(data.name);
      toast.success('标签已添加', { description: data.name });
      if (data.synonyms.length > 0) {
        toast.message('同义词已记录', {
          description: '服务端同义词归并将在后续版本生效'
        });
      }
      await refresh();
    } catch (error) {
      toast.error(readErrorMessage(error));
      throw error;
    } finally {
      setSubmittingTag(false);
    }
  }

  async function handleAddTheme(data: {
    name: string;
    path: string;
    isMonitoring: boolean;
  }): Promise<void> {
    setSubmittingTheme(true);
    try {
      const result = await importSource(data.path, data.name, data.isMonitoring);
      toast.success('主题集合已创建', {
        description: `新增 ${result.indexed} 个素材，跳过 ${result.skipped} 个`
      });
      await refresh();
    } catch (error) {
      toast.error(readErrorMessage(error));
      throw error;
    } finally {
      setSubmittingTheme(false);
    }
  }

  function handleTagAction(action: 'merge' | 'edit' | 'delete'): void {
    toast.message('功能开发中', {
      description:
        action === 'merge'
          ? '标签归并将由 collections API 提供'
          : action === 'edit'
            ? '标签编辑将在后续版本开放'
            : '标签删除将在后续版本开放'
    });
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      <PageHeader title="标签与主题管理" description="管理素材分类、标签归并和同义词" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">主题集合</h2>
                <Button size="sm" onClick={() => setAddThemeDialogOpen(true)}>
                  <Plus className="size-4 mr-1" />
                  新建
                </Button>
              </div>

              <AddSourceDialog
                open={addThemeDialogOpen}
                onOpenChange={setAddThemeDialogOpen}
                onConfirm={handleAddTheme}
                submitting={submittingTheme}
              />

              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground py-2">加载主题集合…</p>
                ) : sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无主题集合，点击「新建」导入素材目录。</p>
                ) : (
                  sources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{source.name}</span>
                      </div>
                      <Badge variant="outline">{source.assetCount}</Badge>
                    </button>
                  ))
                )}
              </div>
            </Card>

            {aiRecommendedTags.length > 0 ? (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="font-semibold text-foreground">AI 推荐主题</h2>
                </div>

                <p className="text-sm text-muted-foreground mb-4">需要确认后归类到主题集合</p>

                <div className="space-y-2">
                  {aiRecommendedTags.map((tag) => (
                    <div key={tag.id} className="p-3 rounded-lg border bg-muted/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{tag.displayName}</span>
                        <Badge variant="outline" className="bg-background">
                          {tag.assetCount}
                        </Badge>
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
            ) : null}
          </div>

          <div className="lg:col-span-2">
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-foreground">标签管理</h2>
                <div className="flex gap-2">
                  <Input
                    placeholder="搜索标签..."
                    className="w-full sm:w-64"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
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
                submitting={submittingTag}
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
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                          加载标签…
                        </TableCell>
                      </TableRow>
                    ) : filteredTags.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                          暂无标签
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTags.map((tag) => {
                        const synonyms = synonymMap.get(tag.id) ?? [];

                        return (
                          <TableRow key={tag.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{tag.displayName}</div>
                                {synonyms.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {synonyms.map((synonym) => (
                                      <Badge key={synonym} variant="outline" className="text-xs">
                                        {synonym}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{tag.normalizedName}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  tag.source === 'ai' ? 'default' : tag.source === 'user' ? 'secondary' : 'outline'
                                }
                              >
                                {tag.source === 'ai' ? 'AI' : tag.source === 'user' ? '用户' : '系统'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {tag.maxConfidence !== null ? (
                                <span className="text-sm text-muted-foreground">{Math.round(tag.maxConfidence * 100)}%</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tag.assetCount} 个</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleTagAction('merge')}>
                                  <Merge className="size-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleTagAction('edit')}>
                                  <Edit className="size-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleTagAction('delete')}>
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 p-4 bg-muted border border-border rounded-lg">
                <p className="text-sm font-medium text-foreground mb-1">同义词归并</p>
                <p className="text-sm text-muted-foreground">
                  系统会自动将相似标签（如&quot;牛仔布&quot;、&quot;denim fabric&quot;、&quot;denim&quot;）归并到同一标签组，
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
