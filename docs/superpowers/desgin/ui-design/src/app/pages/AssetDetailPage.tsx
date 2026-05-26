import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, FileVideo, FileImage, FileAudio, Calendar, HardDrive, Clock, Copy, FolderOpen, RefreshCw, Zap } from 'lucide-react';
import { mockAssets } from '../mock-data';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export function AssetDetailPage() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const asset = mockAssets.find((a) => a.id === assetId);

  if (!asset) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">素材不存在</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            返回素材库
          </Button>
        </div>
      </div>
    );
  }

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
        return <FileVideo className="size-6" />;
      case 'image':
        return <FileImage className="size-6" />;
      case 'audio':
        return <FileAudio className="size-6" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-lg text-gray-900 truncate">{asset.fileName}</h1>
              <p className="text-sm text-gray-600 truncate">{asset.path}</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Preview */}
          <div className="rounded-lg overflow-hidden bg-gray-100">
            <div className="aspect-video flex items-center justify-center">
              <img
                src={asset.thumbnailUrl}
                alt={asset.fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column: File Info & Tags */}
            <div className="col-span-2 space-y-6">
              {/* File Information */}
              <div className="border rounded-lg p-6">
                <h2 className="font-semibold text-gray-900 mb-4">文件信息</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <HardDrive className="size-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 w-20">大小:</span>
                    <span className="text-gray-900">{formatFileSize(asset.size)}</span>
                  </div>
                  {asset.duration && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="size-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 w-20">时长:</span>
                      <span className="text-gray-900">{formatDuration(asset.duration)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="size-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 w-20">创建时间:</span>
                    <span className="text-gray-900">{formatDate(asset.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="size-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 w-20">修改时间:</span>
                    <span className="text-gray-900">{formatDate(asset.modifiedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="border rounded-lg p-6">
                <h2 className="font-semibold text-gray-900 mb-4">标签</h2>
                <div className="flex flex-wrap gap-2">
                  {asset.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={tag.type === 'ai' ? 'default' : tag.type === 'user' ? 'secondary' : 'outline'}
                      className="text-sm"
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
                <p className="text-xs text-gray-500 mt-4">
                  AI 标签可能不完全准确，支持手动修正
                </p>
              </div>

              {/* Video Specific Content */}
              {asset.fileType === 'video' && (
                <div className="border rounded-lg p-6">
                  <Tabs defaultValue="frames" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="frames" className="flex-1">
                        关键帧 {asset.frames?.length || 0}
                      </TabsTrigger>
                      <TabsTrigger value="transcripts" className="flex-1">
                        字幕 {asset.transcripts?.length || 0}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="frames" className="space-y-4">
                      {asset.frames && asset.frames.length > 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                          {asset.frames.map((frame) => (
                            <div key={frame.id} className="border rounded-lg overflow-hidden">
                              <div className="aspect-video bg-gray-100">
                                <img
                                  src={frame.thumbnailUrl}
                                  alt={`Frame at ${formatTimestamp(frame.timestamp)}`}
                                  className="size-full object-cover"
                                />
                              </div>
                              <div className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-900">
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
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-8">
                          暂无关键帧数据
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="transcripts" className="space-y-3">
                      {asset.transcripts && asset.transcripts.length > 0 ? (
                        asset.transcripts.map((transcript) => (
                          <div key={transcript.id} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {transcript.language === 'ru' ? '俄文' : transcript.language === 'en' ? '英文' : '中文'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(transcript.startTime)} - {formatTimestamp(transcript.endTime)}
                              </span>
                            </div>
                            <p className="text-sm mb-2 text-gray-900">{transcript.text}</p>
                            {transcript.translation && (
                              <p className="text-sm text-gray-600 italic">
                                翻译: {transcript.translation}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-8">
                          暂无字幕数据
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>

            {/* Right Column: Actions */}
            <div className="col-span-1 space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <h2 className="font-semibold text-gray-900">操作</h2>

                <Button variant="outline" className="w-full justify-start">
                  <Copy className="size-4 mr-2" />
                  复制路径
                </Button>

                <Button variant="outline" className="w-full justify-start">
                  <FolderOpen className="size-4 mr-2" />
                  在文件夹中显示
                </Button>

                <Button variant="outline" className="w-full justify-start">
                  <RefreshCw className="size-4 mr-2" />
                  重新解析
                </Button>

                <Separator />

                <Button
                  variant="outline"
                  className="w-full justify-start border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Zap className="size-4 mr-2" />
                  <span className="flex-1 text-left">开启精查模式</span>
                </Button>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    每 3 秒抽一帧，可能增加云端调用成本
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
