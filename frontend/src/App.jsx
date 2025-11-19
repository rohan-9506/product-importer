import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Acme Product Importer</h1>
          <p>Upload, manage, and sync 500k+ products without breaking a sweat.</p>
        </div>
        <div className="header-meta">
          <span className="badge">Flask · Celery · PostgreSQL</span>
          <span className="badge">React Frontend</span>
        </div>
      </header>

      <main className="app-grid">
        <section className="panel">
          <h2>CSV Upload</h2>
          <UploadSection />
        </section>

        <section className="panel span-2">
          <h2>Product Management</h2>
          <ProductSection />
        </section>

        <section className="panel span-2">
          <h2>Webhook Configuration</h2>
          <WebhookSection />
        </section>
      </main>
    </div>
  )
}

function UploadSection() {
  const [file, setFile] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [job, setJob] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId) return undefined
    let intervalId = null
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/jobs/${jobId}`)
        if (!res.ok) throw new Error('Unable to fetch job status')
        const data = await res.json()
        setJob(data)
        if (['completed', 'failed'].includes(data.status) && intervalId) {
          clearInterval(intervalId)
        }
      } catch (err) {
        setError(err.message)
      }
    }
    fetchStatus()
    intervalId = setInterval(fetchStatus, 2000)
    return () => clearInterval(intervalId)
  }, [jobId])

  useEffect(() => {
    if (job?.status) {
      setStatus(job.status)
    }
    if (job?.status === 'completed') {
      // ensure UI reflects newly imported records without manual reload
      window.location.reload()
    }
  }, [job])

  const progress = useMemo(() => {
    if (!job || !job.total_rows) return 0
    return Math.min(100, Math.round((job.processed_rows / job.total_rows) * 100))
  }, [job])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      setError('Please choose a CSV file first.')
      return
    }
    setError('')
    setStatus('uploading')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/uploads/`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      setJobId(data.job_id)
      setJob(null)
      setStatus('processing')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  return (
    <div className="stack gap-md">
      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="file-input">
          <span>Choose CSV file</span>
          <input
            type="file"
            accept=".csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setError('')
            }}
          />
        </label>
        <button type="submit" className="btn primary" disabled={!file || status === 'uploading'}>
          {status === 'uploading' ? 'Uploading…' : 'Start Import'}
        </button>
      </form>

      {jobId && (
        <div className="job-status">
          <div className="job-meta">
            <div>
              <p className="label">Job ID</p>
              <p className="mono">{jobId}</p>
            </div>
            <div>
              <p className="label">Status</p>
              <p className={`status ${job?.status || 'queued'}`}>{job?.status ?? 'queued'}</p>
            </div>
            <div>
              <p className="label">Progress</p>
              <p>
                {job?.processed_rows ?? 0}/{job?.total_rows ?? '—'}
              </p>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }} />
          </div>
          <p className="status-hint">
            {job?.status === 'processing' && 'Parsing CSV and writing to PostgreSQL…'}
            {job?.status === 'completed' && 'Import complete!'}
            {job?.status === 'failed' && `Failed: ${job?.error_message}`}
            {!job && 'Queued… waiting for worker.'}
          </p>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
    </div>
  )
}

const initialProductForm = {
  sku: '',
  name: '',
  description: '',
  price: '',
  is_active: true,
}

function ProductSection() {
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState({ sku: '', name: '', description: '', is_active: '' })
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(initialProductForm)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')
  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const fetchProducts = async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, per_page: perPage })
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null) params.append(key, value)
    })
    try {
      const res = await fetch(`${API_BASE}/products/?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to fetch products')
      setProducts(data.items)
      setTotal(data.total)
      setMessage('')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, JSON.stringify(filters)])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      price: form.price ? Number(form.price) : null,
    }

    try {
      const endpoint = editingId ? `${API_BASE}/products/${editingId}` : `${API_BASE}/products/`
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setMessage(editingId ? 'Product updated' : 'Product created')
      setForm(initialProductForm)
      setEditingId(null)
      fetchProducts()
    } catch (err) {
      setMessage(err.message)
    }
  }

  const handleEdit = (product) => {
    setEditingId(product.id)
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      price: product.price ?? '',
      is_active: product.is_active,
    })
  }

  const handleDelete = async (productId) => {
    if (!window.confirm('Delete this product?')) return
    await fetch(`${API_BASE}/products/${productId}`, { method: 'DELETE' })
    fetchProducts()
  }

  const handleBulkDelete = async () => {
    if (!window.confirm('Delete ALL products? This cannot be undone.')) return
    await fetch(`${API_BASE}/products/bulk-delete`, { method: 'POST' })
    fetchProducts()
  }

  const totalPages = Math.ceil(total / perPage) || 1

  return (
    <div className="stack gap-lg">
      <div className="filters">
        <input
          placeholder="Filter by SKU"
          value={filters.sku}
          onChange={(e) => updateFilter('sku', e.target.value)}
        />
        <input
          placeholder="Name contains"
          value={filters.name}
          onChange={(e) => updateFilter('name', e.target.value)}
        />
        <input
          placeholder="Description contains"
          value={filters.description}
          onChange={(e) => updateFilter('description', e.target.value)}
        />
        <select
          value={filters.is_active}
          onChange={(e) => updateFilter('is_active', e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button
          className="btn ghost"
          onClick={() => {
            setFilters({ sku: '', name: '', description: '', is_active: '' })
            setPage(1)
          }}
        >
          Clear
        </button>
        <button className="btn danger" onClick={handleBulkDelete}>
          Bulk Delete
        </button>
      </div>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <input
            required
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Price"
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <select
            value={form.is_active ? 'true' : 'false'}
            onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <textarea
          rows={2}
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="form-actions">
          <button type="submit" className="btn primary">
            {editingId ? 'Update Product' : 'Add Product'}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditingId(null)
                setForm(initialProductForm)
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && <div className="alert">{message}</div>}

      <div className="table-wrapper">
        {loading ? (
          <p>Loading products…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Status</th>
                <th>Price</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="mono">{product.sku}</td>
                  <td>{product.name}</td>
                  <td>
                    <span className={`pill ${product.is_active ? 'success' : 'muted'}`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{product.price ?? '—'}</td>
                  <td>{product.description ?? '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn ghost" onClick={() => handleEdit(product)}>
                        Edit
                      </button>
                      <button className="btn danger ghost" onClick={() => handleDelete(product.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button className="btn ghost" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}

const initialWebhookForm = { name: '', url: '', event_type: 'product.import.completed', is_enabled: true }

function WebhookSection() {
  const [webhooks, setWebhooks] = useState([])
  const [form, setForm] = useState(initialWebhookForm)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')

  const fetchWebhooks = async () => {
    const res = await fetch(`${API_BASE}/webhooks/`)
    const data = await res.json()
    setWebhooks(data)
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const payload = { ...form }
    const endpoint = editingId ? `${API_BASE}/webhooks/${editingId}` : `${API_BASE}/webhooks/`
    const method = editingId ? 'PUT' : 'POST'
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json()
      setMessage(data.error || 'Save failed')
      return
    }
    setMessage(editingId ? 'Webhook updated' : 'Webhook created')
    setForm(initialWebhookForm)
    setEditingId(null)
    fetchWebhooks()
  }

  const handleEdit = (webhook) => {
    setEditingId(webhook.id)
    setForm({
      name: webhook.name,
      url: webhook.url,
      event_type: webhook.event_type,
      is_enabled: webhook.is_enabled,
    })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete webhook?')) return
    await fetch(`${API_BASE}/webhooks/${id}`, { method: 'DELETE' })
    fetchWebhooks()
  }

  const handleTest = async (id) => {
    const res = await fetch(`${API_BASE}/webhooks/${id}/test`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setMessage(`Webhook responded in ${data.elapsed_ms}ms with status ${data.status_code}`)
    } else {
      setMessage(`Test failed: ${data.error}`)
    }
    fetchWebhooks()
  }

  return (
    <div className="stack gap-lg">
      <form className="webhook-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <input
            required
            placeholder="Friendly name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            required
            placeholder="https://example.com/webhook"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <select
            value={form.event_type}
            onChange={(e) => setForm({ ...form, event_type: e.target.value })}
          >
            <option value="product.import.started">Import Started</option>
            <option value="product.import.completed">Import Completed</option>
            <option value="product.import.failed">Import Failed</option>
          </select>
          <select
            value={form.is_enabled ? 'true' : 'false'}
            onChange={(e) => setForm({ ...form, is_enabled: e.target.value === 'true' })}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn primary">
            {editingId ? 'Update Webhook' : 'Add Webhook'}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditingId(null)
                setForm(initialWebhookForm)
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && <div className="alert">{message}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>URL</th>
              <th>Event</th>
              <th>Status</th>
              <th>Last Response</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map((hook) => (
              <tr key={hook.id}>
                <td>{hook.name}</td>
                <td className="mono">{hook.url}</td>
                <td>{hook.event_type}</td>
                <td>
                  <span className={`pill ${hook.is_enabled ? 'success' : 'muted'}`}>
                    {hook.is_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>
                  {hook.last_response_code ? (
                    <>
                      {hook.last_response_code} ({hook.last_response_ms ?? '—'}ms)
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn ghost" onClick={() => handleEdit(hook)}>
                      Edit
                    </button>
                    <button className="btn primary ghost" onClick={() => handleTest(hook.id)}>
                      Test
                    </button>
                    <button className="btn danger ghost" onClick={() => handleDelete(hook.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td colSpan="6" className="empty">
                  No webhooks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App
