import { X, FileVideo, FileImage, FileAudio, Calendar, HardDrive, Clock, Copy, FolderOpen, RefreshCw, Zap } from 'lucide-react';
import { Asset } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface DetailPanelProps {
  asset: Asset;
  onClose: () => void;
}

export function DetailPanel({ asset, onClose }: DetailPanelProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = () => {
    switch (asset.fileType) {
      case 'video':
        return <FileVideo className="size-5" />;
      case 'image':
        return <FileImage className="size-5" />;
      case 'audio':
        return <FileAudio className="size-5" />;
    }
  };

  return (
    <div className="w-96 border-l flex flex-col h-full bg-card">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">素材详情</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={asset.thumbnailUrl}
              alt={asset.fileName}
              className="size-full object-cover"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              {getFileIcon()}
              <h3 className="font-medium break-all">{asset.fileName}</h3>
            </div>
            <p className="text-sm text-muted-foreground break-all">{asset.path}</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium">文件信息</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">大小:</span>
                <span>{formatFileSize(asset.size)}</span>
              </div>
              {asset.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">时长:</span>
                  <span>{formatDuration(asset.duration)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">创建时间:</span>
                <span>{formatDate(asset.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">修改时间:</span>
                <span>{formatDate(asset.modifiedAt)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                <Copy className="size-3 mr-1" />
                复制路径
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <FolderOpen className="size-3 mr-1" />
                打开位置
              </Button>
            </div>
            <Button size="sm" variant="outline" className="w-full">
              <RefreshCw className="size-3 mr-1" />
              重新解析
            </Button>
            <Button size="sm" variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
              <Zap className="size-3 mr-1" />
              开启精查模式
              <span className="ml-auto text-xs">可能增加成本</span>
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium">标签</h4>
            <div className="flex flex-wrap gap-2">
              {asset.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={tag.type === 'ai' ? 'default' : tag.type === 'user' ? 'secondary' : 'outline'}
                >
                  {tag.name}
                  {tag.confidence && (
                    <span className="ml-1 text-xs opacity-70">
                      {Math.round(tag.confidence * 100)}%
                    </span>
                  )}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              AI 标签可能不完全准确，支持手动修正
            </p>
          </div>

          {asset.fileType === 'video' && (
            <>
              <Separator />
              <Tabs defaultValue="frames" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="frames" className="flex-1">
                    关键帧 {asset.frames?.length || 0}
                  </TabsTrigger>
                  <TabsTrigger value="transcripts" className="flex-1">
                    字幕 {asset.transcripts?.length || 0}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="frames" className="space-y-3 mt-4">
                  {asset.frames && asset.frames.length > 0 ? (
                    asset.frames.map((frame) => (
                      <div key={frame.id} className="border rounded-lg overflow-hidden">
                        <div className="aspect-video bg-muted">
                          <img
                            src={frame.thumbnailUrl}
                            alt={`Frame at ${formatTimestamp(frame.timestamp)}`}
                            className="size-full object-cover"
                          />
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {formatTimestamp(frame.timestamp)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {frame.tags.map((tag) => (
                              <Badge key={tag.id} variant="outline" className="text-xs">
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无关键帧数据
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="transcripts" className="space-y-3 mt-4">
                  {asset.transcripts && asset.transcripts.length > 0 ? (
                    asset.transcripts.map((transcript) => (
                      <div key={transcript.id} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {transcript.language === 'ru' ? '俄文' : transcript.language === 'en' ? '英文' : '中文'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(transcript.startTime)} - {formatTimestamp(transcript.endTime)}
                          </span>
                        </div>
                        <p className="text-sm mb-2">{transcript.text}</p>
                        {transcript.translation && (
                          <p className="text-sm text-muted-foreground italic">
                            翻译: {transcript.translation}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无字幕数据
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
