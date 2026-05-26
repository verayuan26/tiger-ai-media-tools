import { Shield, DollarSign, Zap, HardDrive, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';

export function SettingsPage() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [dailyBudget, setDailyBudget] = useState([50]);
  const [concurrentTasks, setConcurrentTasks] = useState([3]);
  const [apiProtocol, setApiProtocol] = useState('openai');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('sk-xxxxxxxxxxxxxxxxxxxxxxxx');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // 模拟 API 测试
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 随机成功或失败用于演示
    const success = Math.random() > 0.3;

    if (success) {
      setTestResult('success');
      toast.success('连接成功', {
        description: 'AI API 配置正确，可以正常使用',
      });
    } else {
      setTestResult('error');
      toast.error('连接失败', {
        description: '请检查 API Key 和端点地址是否正确',
      });
    }

    setTesting(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">设置</h1>
            <p className="text-sm text-gray-600 mt-1">配置 API、成本控制和隐私保护</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* API Configuration */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-100">
                <Zap className="size-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">云端 AI 配置</h2>
                <p className="text-sm text-gray-600">配置视觉识别和语音识别 API</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="api-protocol">协议类型</Label>
                <Select value={apiProtocol} onValueChange={setApiProtocol}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="选择协议类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="azure">Azure OpenAI</SelectItem>
                    <SelectItem value="custom">自定义协议</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="api-endpoint">API 端点地址</Label>
                <Input
                  id="api-endpoint"
                  type="text"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  可以配置为自建代理或第三方服务地址
                </p>
              </div>

              <div>
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing || !apiKey}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        测试中
                      </>
                    ) : (
                      '测试连接'
                    )}
                  </Button>
                </div>
                {testResult && (
                  <div className={`flex items-center gap-2 mt-2 text-sm ${testResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle className="size-4" />
                        <span>连接成功</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="size-4" />
                        <span>连接失败，请检查配置</span>
                      </>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  API Key 仅保存在本地，不会上传到云端
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">上传内容说明</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 视频：仅上传压缩后的关键帧图片，不上传完整视频文件</li>
                  <li>• 图片：上传压缩版本用于分析，原图保留在本地</li>
                  <li>• 音频：仅上传必要的音频片段用于语音识别</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Cost Control */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-amber-100">
                <DollarSign className="size-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">成本控制</h2>
                <p className="text-sm text-gray-600">设置每日预算和并发限制</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>每日预算上限</Label>
                  <span className="text-sm font-medium text-gray-900">¥{dailyBudget[0]}</span>
                </div>
                <Slider
                  value={dailyBudget}
                  onValueChange={setDailyBudget}
                  min={10}
                  max={500}
                  step={10}
                  className="mb-2"
                />
                <p className="text-xs text-gray-500">
                  达到每日预算后，新任务将暂停，次日自动恢复
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>并发任务上限</Label>
                  <span className="text-sm font-medium text-gray-900">{concurrentTasks[0]} 个</span>
                </div>
                <Slider
                  value={concurrentTasks}
                  onValueChange={setConcurrentTasks}
                  min={1}
                  max={10}
                  step={1}
                  className="mb-2"
                />
                <p className="text-xs text-gray-500">
                  控制同时处理的任务数量，避免 API 限流
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">精查模式默认开关</p>
                  <p className="text-sm text-gray-600 mt-1">
                    开启后视频默认每 3 秒抽一帧（可能增加成本）
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>

          {/* Cache Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-green-100">
                <HardDrive className="size-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">缓存设置</h2>
                <p className="text-sm text-gray-600">复用已解析结果，节省成本</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">复用已解析结果</p>
                  <p className="text-sm text-gray-600 mt-1">
                    相同文件（基于 hash）自动复用标签和字幕
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="p-4 bg-gray-50 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">缓存大小</p>
                    <p className="text-xs text-gray-600 mt-1">本地缓存占用空间</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">2.3 GB</p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs mt-1">
                      清理缓存
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* File Protection */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-100">
                <Shield className="size-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">文件保护</h2>
                <p className="text-sm text-gray-600">原始文件安全策略</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-3">默认保护策略</p>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>默认不移动原始文件位置</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>默认不重命名原始文件</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>默认不修改原始文件内容和元数据</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>所有文件操作（复制、移动、重命名）需要明确确认</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg mt-4">
              <div>
                <p className="font-medium text-gray-900">操作前确认提示</p>
                <p className="text-sm text-gray-600 mt-1">
                  执行文件操作前显示确认对话框
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline">取消</Button>
            <Button className="bg-[#4a6fa5] hover:bg-[#3d5a8a]">保存设置</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
