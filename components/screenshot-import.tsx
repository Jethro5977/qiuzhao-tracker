'use client';

import { useRef, useState } from 'react';
import { ImageUp, LoaderCircle, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseScreenshotText } from '@/lib/screenshot';
import type { ScreenshotCandidate } from '@/lib/screenshot';
import type { Job } from '@/lib/tracker';

type Props = {
  onSelect: (job: Job) => void;
  disabled?: boolean;
};

export function ScreenshotImport({ onSelect, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [candidates, setCandidates] = useState<ScreenshotCandidate[]>([]);

  function parse(textToParse: string) {
    const next = parseScreenshotText(textToParse);
    if (!next.length)
      throw new Error(
        '没有找到完整的公司和岗位。请上传更清晰、包含岗位卡片标题与公司名称的截图，或手动修正识别文字。',
      );
    setCandidates(next);
    setError('');
  }

  async function recognize(file?: File) {
    if (!file || busy) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择 PNG、JPG、WEBP 等图片文件。');
      return;
    }
    if (file.size > 15_000_000) {
      setError('单张截图不能超过 15 MB。');
      return;
    }
    setBusy(true);
    setError('');
    setCandidates([]);
    let worker: {
      recognize: (image: File) => Promise<{ data: { text: string } }>;
      terminate: () => Promise<unknown>;
    } | null = null;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('chi_sim+eng', 1, {
        logger: (message) => {
          if (message.status === 'recognizing text')
            setProgress(`正在识别文字 ${Math.round(message.progress * 100)}%`);
          else if (message.status) setProgress('正在准备本地识别…');
        },
      });
      setProgress('正在识别截图…');
      const result = await worker.recognize(file);
      setText(result.data.text);
      parse(result.data.text);
      setProgress('识别完成，请逐条核对后录入。');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `识别失败：${cause.message}`
          : '识别失败，请稍后重试。',
      );
      setProgress('');
    } finally {
      if (worker) await worker.terminate();
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <ScanText className="size-5 text-violet-700" />
            截图识别并更新进度
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            上传投递、笔试或面试页面截图，识别在当前设备进行。识别结果需核对后才会写入台账。
          </p>
        </div>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => void recognize(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || disabled}
          onClick={() => input.current?.click()}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <ImageUp />}
          {busy ? '识别中' : '上传截图'}
        </Button>
      </div>
      {(progress || error) && (
        <p
          className={
            'mt-3 text-sm ' + (error ? 'text-rose-700' : 'text-violet-800')
          }
          role={error ? 'alert' : undefined}
        >
          {error || progress}
        </p>
      )}
      {text && (
        <details className="mt-3 rounded-lg border border-violet-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            查看或修正识别文字
          </summary>
          <Textarea
            className="mt-3 min-h-36"
            aria-label="截图识别文字"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button
            className="mt-2"
            type="button"
            variant="outline"
            onClick={() => {
              try {
                parse(text);
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : '无法生成候选记录',
                );
              }
            }}
          >
            重新生成候选记录
          </Button>
        </details>
      )}
      {candidates.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-slate-800">
            识别到 {candidates.length} 条候选记录
          </p>
          {candidates.map((candidate) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200 bg-white p-3"
              key={candidate.job.id}
            >
              <div className="min-w-0">
                <strong className="block text-sm text-slate-900">
                  {candidate.job.company} · {candidate.job.position}
                </strong>
                <span className="mt-1 block text-sm text-slate-600">
                  {candidate.job.status}
                  {candidate.observedAt
                    ? ` · 页面更新 ${candidate.observedAt}`
                    : ''}
                </span>
                {candidate.notice && (
                  <span className="mt-1 block text-xs text-amber-800">
                    {candidate.notice}
                  </span>
                )}
              </div>
              <Button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(candidate.job)}
              >
                核对并录入
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
