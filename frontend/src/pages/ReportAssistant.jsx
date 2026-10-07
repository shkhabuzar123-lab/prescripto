import React, { useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { LANGS, STRINGS, specialityLabel } from '../i18n/reportAssistant'

const MAX_FILES = 3
const MAX_SIZE = 4 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'

const STATUS_STYLE = {
  normal: 'bg-green-100 text-green-700',
  borderline: 'bg-yellow-100 text-yellow-700',
  abnormal: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
}
const URGENCY_STYLE = {
  routine: 'bg-green-50 border-green-200 text-green-800',
  soon: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  urgent: 'bg-red-50 border-red-200 text-red-800',
}

// ---------- doctor cards recommended by the assistant ----------
const DoctorRecs = ({ recommendations, t, lang }) => {
  const navigate = useNavigate()
  if (!recommendations?.length) return null
  return (
    <div className='mt-5'>
      <p className='font-medium mb-1'>{t.doctors}</p>
      {recommendations.map((r, i) => (
        <div key={i} className='mt-3'>
          <p className='text-sm text-gray-600 mb-2'>
            <span className='font-medium text-[#262626]'>{specialityLabel(r.speciality, lang)}</span> — {r.reason}
          </p>
          <div className='grid grid-cols-auto gap-3'>
            {r.doctors.map(d => (
              <div key={d._id} onClick={() => { navigate(`/appointment/${d._id}`); scrollTo(0, 0) }}
                className='border border-[#C9D8FF] bg-white rounded-xl overflow-hidden cursor-pointer hover:translate-y-[-4px] transition-all duration-300'>
                <img className='bg-[#EAEFFF]' src={d.image} alt='' />
                <div className='p-3'>
                  <div className={`flex items-center gap-2 text-xs ${d.available ? 'text-green-500' : 'text-gray-500'}`}>
                    <p className={`w-2 h-2 rounded-full ${d.available ? 'bg-green-500' : 'bg-gray-500'}`}></p>
                    <p>{d.available ? t.available : t.unavailable}</p>
                  </div>
                  <p className='font-medium'>{d.name}</p>
                  <p className='text-[#5C5C5C] text-sm'>{specialityLabel(d.speciality, lang)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p onClick={() => navigate('/doctors')} className='text-sm text-primary underline cursor-pointer mt-3'>{t.browseAll}</p>
    </div>
  )
}

// ---------- one chat message ----------
const ChatMessage = ({ m, t, lang }) => {
  if (m.role === 'user') {
    return (
      <div className='flex justify-end'>
        <div className='max-w-[85%] bg-primary text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm'>
          {m.fileNames?.map((n, i) => <p key={i} className='text-xs opacity-90 mb-1'>📎 {n}</p>)}
          {m.content && <p className='whitespace-pre-wrap'>{m.content}</p>}
        </div>
      </div>
    )
  }

  const a = m.analysis
  return (
    <div className='flex justify-start'>
      <div className='max-w-[95%] w-full sm:w-auto bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-[#262626]'>
        {m.type === 'analysis' && a ? (
          <>
            {a.reportType && <p className='text-xs text-gray-500 mb-1'>{a.reportType}</p>}
            <p className='font-medium'>{t.summary}</p>
            <p className='leading-6 text-gray-700 whitespace-pre-line'>{m.content}</p>

            {a.isMedicalReport && (
              <>
                {a.urgency && (
                  <div className={`border rounded-xl p-3 mt-3 ${URGENCY_STYLE[a.urgency] || URGENCY_STYLE.routine}`}>
                    <p className='font-medium'>{t.urgency[a.urgency]}</p>
                    <p className='text-sm mt-1'>{a.urgencyReason}</p>
                  </div>
                )}
                {a.keyFindings?.length > 0 && (
                  <div className='mt-4'>
                    <p className='font-medium mb-2'>{t.findings}</p>
                    <div className='flex flex-col gap-2'>
                      {a.keyFindings.map((f, i) => (
                        <div key={i} className='bg-white border border-gray-200 rounded-xl p-3'>
                          <div className='flex flex-wrap items-center justify-between gap-2'>
                            <p className='font-medium'>{f.name}</p>
                            <span className={`text-xs px-3 py-0.5 rounded-full ${STATUS_STYLE[f.status] || STATUS_STYLE.unknown}`}>{t.status[f.status] || f.status}</span>
                          </div>
                          <p className='text-primary mt-0.5'>{f.value}</p>
                          <p className='text-gray-600 mt-1 leading-6'>{f.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <DoctorRecs recommendations={m.recommendations} t={t} lang={lang} />
                {a.questionsForDoctor?.length > 0 && (
                  <div className='mt-4'>
                    <p className='font-medium mb-1'>{t.questions}</p>
                    <ul className='list-disc pl-5 text-gray-700 leading-7'>
                      {a.questionsForDoctor.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p className='leading-6 whitespace-pre-line'>{m.content}</p>
            <DoctorRecs recommendations={m.recommendations} t={t} lang={lang} />
          </>
        )}
      </div>
    </div>
  )
}

const ReportAssistant = () => {

  const { token, backendUrl } = useContext(AppContext)
  const navigate = useNavigate()
  const fileRef = useRef(null)
    const listRef = useRef(null)

  const [lang, setLang] = useState(localStorage.getItem('reportLang') || 'en')
  const t = STRINGS[lang] || STRINGS.en

  const [messages, setMessages] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [files, setFiles] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const changeLang = (code) => { setLang(code); localStorage.setItem('reportLang', code) }

  // load this account's saved conversation
  useEffect(() => {
    if (!token) return
    setHistoryLoading(true)
    axios.get(backendUrl + '/api/user/report-chat', { headers: { token } })
      .then(({ data }) => data.success ? setMessages(data.messages) : toast.error(data.message))
      .catch(err => toast.error(err.message))
      .finally(() => setHistoryLoading(false))
  }, [token])

  // scroll only the chat box (not the whole page) to the newest message
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, historyLoading])

  const addFiles = (list) => {
    const valid = []
    for (const f of Array.from(list)) {
      if (!ACCEPT.split(',').includes(f.type)) { toast.error(`${f.name}: JPG, PNG, WEBP, GIF, PDF only`); continue }
      if (f.size > MAX_SIZE) { toast.error(`${f.name}: max 4 MB`); continue }
      valid.push(f)
    }
    const merged = [...files, ...valid]
    if (merged.length > MAX_FILES) toast.error(`Up to ${MAX_FILES} files`)
    setFiles(merged.slice(0, MAX_FILES))
    if (fileRef.current) fileRef.current.value = ''
  }

  const send = async () => {
    if (sending || (!text.trim() && files.length === 0)) return
    const sentText = text, sentFiles = files
    // show the user's message immediately; restore the input if the request fails
    setMessages(m => [...m, { _id: 'tmp', role: 'user', content: sentText.trim(), fileNames: sentFiles.map(f => f.name) }])
    setText(''); setFiles([]); setSending(true)
    try {
      const formData = new FormData()
      sentFiles.forEach(f => formData.append('reports', f))
      formData.append('message', sentText)
      formData.append('language', lang)
      const { data } = await axios.post(backendUrl + '/api/user/report-chat', formData, { headers: { token } })
      if (data.success) {
        setMessages(m => [...m.filter(x => x._id !== 'tmp'), data.userMessage, data.assistantMessage])
      } else {
        toast.error(data.message)
        setMessages(m => m.filter(x => x._id !== 'tmp')); setText(sentText); setFiles(sentFiles)
      }
    } catch (error) {
      toast.error(error.message)
      setMessages(m => m.filter(x => x._id !== 'tmp')); setText(sentText); setFiles(sentFiles)
    } finally {
      setSending(false)
    }
  }

  const startOver = async () => {
    if (!window.confirm(t.confirmClear)) return
    try {
      const { data } = await axios.delete(backendUrl + '/api/user/report-chat', { headers: { token } })
      if (data.success) setMessages([])
      else toast.error(data.message)
    } catch (error) {
      toast.error(error.message)
    }
  }

  // ---------- not logged in ----------
  if (!token) {
    return (
      <div className='my-16 text-center border border-[#C9D8FF] rounded-xl p-10 max-w-xl mx-auto'>
        <p className='text-xl font-medium text-[#262626]'>{t.loginTitle}</p>
        <p className='text-sm text-gray-500 mt-2'>{t.loginDesc}</p>
        <button onClick={() => navigate('/login')} className='bg-primary text-white px-10 py-3 rounded-full mt-6'>{t.loginBtn}</button>
      </div>
    )
  }

  return (
    <div className='max-w-4xl mx-auto my-6 text-[#262626]'>
      <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
        <div>
          <h1 className='text-2xl font-medium'>{t.title}</h1>
          <p className='text-sm text-gray-500 mt-1 max-w-xl'>{t.subtitle}</p>
        </div>
        <div className='flex items-center gap-2'>
          <select value={lang} onChange={e => changeLang(e.target.value)} aria-label={t.language}
            className='border border-gray-300 rounded-full px-3 py-2 text-sm outline-primary bg-white'>
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          {messages.length > 0 && (
            <button onClick={startOver} className='text-sm border border-gray-300 px-4 py-2 rounded-full hover:bg-gray-100'>{t.startOver}</button>
          )}
        </div>
      </div>

      <div className='flex flex-col h-[68vh] border border-[#C9D8FF] rounded-2xl overflow-hidden'>
                <div ref={listRef} className='flex-1 overflow-y-auto p-4 flex flex-col gap-4'>
          {historyLoading ? (
            <p className='text-center text-sm text-gray-500 mt-10 animate-pulse'>{t.loading}</p>
          ) : messages.length === 0 ? (
            <div className='m-auto text-center max-w-md'>
              <p className='text-lg font-medium'>{t.emptyTitle}</p>
              <p className='text-sm text-gray-500 mt-2'>{t.emptyDesc}</p>
              <p className='text-xs text-gray-400 mt-3'>{t.limits}</p>
            </div>
          ) : (
            messages.map((m, i) => <ChatMessage key={m._id || i} m={m} t={t} lang={lang} />)
          )}
          {sending && <p className='text-sm text-gray-500 animate-pulse'>{t.reading}</p>}
          
        </div>

        <div className='border-t border-[#C9D8FF] p-3'>
          {files.length > 0 && (
            <div className='flex flex-wrap gap-2 mb-2'>
              {files.map((f, i) => (
                <span key={i} className='flex items-center gap-2 bg-[#EAEFFF] text-xs px-3 py-1 rounded-full'>
                  📎 {f.name}
                  <button type='button' aria-label='Remove' onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
                </span>
              ))}
            </div>
          )}
          <div className='flex items-end gap-2'>
            <input ref={fileRef} type='file' hidden multiple accept={ACCEPT} onChange={e => addFiles(e.target.files)} />
            <button type='button' onClick={() => fileRef.current?.click()} disabled={sending}
              className='shrink-0 border border-primary text-primary text-sm px-4 py-2.5 rounded-full hover:bg-primary hover:text-white transition-all disabled:opacity-50'>
              📎 {t.attach}
            </button>
            <textarea value={text} rows={1} maxLength={8000} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
              placeholder={t.placeholder}
              className='flex-1 border border-gray-300 rounded-2xl px-4 py-2.5 text-sm outline-primary resize-none max-h-32' />
            <button type='button' onClick={send} disabled={sending || (!text.trim() && files.length === 0)}
              className='shrink-0 bg-primary text-white text-sm px-6 py-2.5 rounded-full disabled:opacity-50'>{t.send}</button>
          </div>
        </div>
      </div>

      <p className='mt-3 text-xs text-gray-500 text-center'>{t.disclaimer}</p>
    </div>
  )
}

export default ReportAssistant
