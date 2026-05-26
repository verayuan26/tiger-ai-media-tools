import { useEffect, useState } from 'react';
import {
  CheckCircle,
  DollarSign,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  Shield,
  XCircle,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { getSettings, patchSettings, testAiConnection } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import type { AiProviderName, ApiProtocol } from '../../shared/settings';

export function SettingsPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [dailyBudget, setDailyBudget] = useState([50]);
  const [concurrentTasks, setConcurrentTasks] = useState([3]);
  const [apiProtocol, setApiProtocol] = useState<ApiProtocol>('openai');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.openai.com/v1');
  const [aiProviderName, setAiProviderName] = useState<AiProviderName>('mock');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [openAiVisionModel, setOpenAiVisionModel] = useState('');
  const [openAiTranscribeModel, setOpenAiTranscribeModel] = useState('');
  const [precisionModeDefault, setPrecisionModeDefault] = useState(false);
  const [reuseParsedResults, setReuseParsedResults] = useState(true);
  const [dailySpendYuan, setDailySpendYuan] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings(): Promise<void> {
    setLoading(true);
    try {
      const settings = await getSettings();
      setApiProtocol(settings.apiProtocol);
      setApiEndpoint(settings.apiEndpoint);
      setAiProviderName(settings.aiProviderName);
      setApiKeyConfigured(settings.apiKeyConfigured);
      setApiKey('');
      setOpenAiVisionModel(settings.openAiVisionModel);
      setOpenAiTranscribeModel(settings.openAiTranscribeModel);
      setDailyBudget([settings.dailyBudgetYuan]);
      setConcurrentTasks([settings.concurrentTasks]);
      setPrecisionModeDefault(settings.precisionModeDefault);
      setReuseParsedResults(settings.reuseParsedResults);
      setDailySpendYuan(settings.dailySpendYuan);
    } catch (error) {
      toast.error('加载设置失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      const result = await testAiConnection({
        apiProtocol,
        apiEndpoint,
        aiProviderName,
        openAiVisionModel: openAiVisionModel.trim(),
        openAiTranscribeModel: openAiTranscribeModel.trim(),
        ...(apiKey.trim().length > 0 ? { apiKey: apiKey.trim() } : {})
      });

      if (result.ok) {
        setTestResult('success');
        setTestMessage(result.message);
        toast.success('连接成功', { description: result.message });
      } else {
        setTestResult('error');
        setTestMessage(result.message);
        toast.error('连接失败', { description: result.message });
      }
    } catch (error) {
      setTestResult('error');
      const message = error instanceof Error ? error.message : '请检查 API Key 和端点地址';
      setTestMessage(message);
      toast.error('连接失败', { description: message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSettings(): Promise<void> {
    setSaving(true);
    try {
      const settings = await patchSettings({
        apiProtocol,
        apiEndpoint,
        aiProviderName,
        openAiVisionModel: openAiVisionModel.trim(),
        openAiTranscribeModel: openAiTranscribeModel.trim(),
        dailyBudgetYuan: dailyBudget[0],
        concurrentTasks: concurrentTasks[0],
        precisionModeDefault,
        reuseParsedResults,
        ...(apiKey.trim().length > 0 ? { apiKey: apiKey.trim() } : {})
      });
      setApiKeyConfigured(settings.apiKeyConfigured);
      setApiKey('');
      setOpenAiVisionModel(settings.openAiVisionModel);
      setOpenAiTranscribeModel(settings.openAiTranscribeModel);
      setDailySpendYuan(settings.dailySpendYuan);
      toast.success('设置已保存', { description: '配置已写入本地数据库，重启服务后仍生效' });
    } catch (error) {
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      <PageHeader title="设置" description="配置 API、成本控制和隐私保护" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl space-y-6">
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
                <Label htmlFor="ai-provider">AI 提供方</Label>
                <Select value={aiProviderName} onValueChange={(value) => setAiProviderName(value as AiProviderName)}>
                  <SelectTrigger className="mt-2" id="ai-provider">
                    <SelectValue placeholder="选择提供方" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock">本地 Mock（默认，不上传）</SelectItem>
                    <SelectItem value="openai-compatible">OpenAI 兼容 API</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="api-protocol">协议类型</Label>
                <Select value={apiProtocol} onValueChange={(value) => setApiProtocol(value as ApiProtocol)}>
                  <SelectTrigger className="mt-2" id="api-protocol">
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
                  onChange={(event) => setApiEndpoint(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-2">可以配置为自建代理或第三方服务地址</p>
              </div>

              {aiProviderName === 'openai-compatible' ? (
                <>
                  <div>
                    <Label htmlFor="vision-model">视觉识别模型</Label>
                    <Input
                      id="vision-model"
                      type="text"
                      value={openAiVisionModel}
                      onChange={(event) => setOpenAiVisionModel(event.target.value)}
                      placeholder="gpt-4o-mini"
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-2">用于图片/视频关键帧标签分析</p>
                  </div>

                  <div>
                    <Label htmlFor="transcribe-model">语音转写模型</Label>
                    <Input
                      id="transcribe-model"
                      type="text"
                      value={openAiTranscribeModel}
                      onChange={(event) => setOpenAiTranscribeModel(event.target.value)}
                      placeholder="whisper-1"
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-2">用于音频片段转写</p>
                  </div>
                </>
              ) : null}

              <div>
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      className="pr-10"
                      placeholder={apiKeyConfigured ? '已保存，留空则不修改' : 'sk-...'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button variant="outline" onClick={() => void handleTestConnection()} disabled={testing}>
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
                {testResult ? (
                  <div
                    className={`flex items-center gap-2 mt-2 text-sm ${
                      testResult === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle className="size-4" />
                        <span>{testMessage || '连接成功'}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="size-4" />
                        <span>{testMessage || '连接失败，请检查配置'}</span>
                      </>
                    )}
                  </div>
                ) : null}
                <p className="text-xs text-gray-500 mt-2">API Key 保存在本地 SQLite，不会上传到第三方控制台</p>
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
                <Slider value={dailyBudget} onValueChange={setDailyBudget} min={10} max={500} step={10} className="mb-2" />
                <p className="text-xs text-gray-500">
                  今日已用 ¥{dailySpendYuan.toFixed(2)}；达到预算后新的 AI 任务将被拒绝
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
                <p className="text-xs text-gray-500">控制同时处于 processing 状态的任务数量</p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">精查模式默认开关</p>
                  <p className="text-sm text-gray-600 mt-1">开启后视频默认每 3 秒抽一帧（可能增加成本）</p>
                </div>
                <Switch checked={precisionModeDefault} onCheckedChange={setPrecisionModeDefault} />
              </div>
            </div>
          </Card>

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
                  <p className="text-sm text-gray-600 mt-1">相同文件（基于 hash）自动复用标签和字幕</p>
                </div>
                <Switch checked={reuseParsedResults} onCheckedChange={setReuseParsedResults} />
              </div>

              <div className="p-4 bg-gray-50 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">缓存大小</p>
                    <p className="text-xs text-gray-600 mt-1">本地缓存占用空间</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">—</p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" disabled>
                      清理缓存
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

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
                <p className="text-sm text-gray-600 mt-1">执行文件操作前显示确认对话框</p>
              </div>
              <Switch defaultChecked />
            </div>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => void loadSettings()} disabled={saving}>
              重置
            </Button>
            <Button
              className="bg-[#4a6fa5] hover:bg-[#3d5a8a]"
              onClick={() => void handleSaveSettings()}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  保存中
                </>
              ) : (
                '保存设置'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
