# Quick Approval UI - Add to Dashboard

**Goal:** Show pending approval count and link to Supabase

**Location:** Add to existing dashboard

---

## Option 1: Add Notification Badge (Simplest)

**File:** `app/squad/page.tsx`

**Add this to the stats section (around line 200):**

```typescript
// Add approval count to stats
const [approvalCount, setApprovalCount] = useState(0)

useEffect(() => {
  async function fetchApprovalCount() {
    const { data, error } = await supabase
      .from('squad_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('requires_approval', true)
      .is('approved_at', null)

    if (!error && data) {
      setApprovalCount(data.length)
    }
  }

  fetchApprovalCount()
  const interval = setInterval(fetchApprovalCount, 30000) // Refresh every 30s
  return () => clearInterval(interval)
}, [])

// Add to your stats display
<div className="stat-card">
  <div className="stat-icon">⏸️</div>
  <div className="stat-value">{approvalCount}</div>
  <div className="stat-label">Pending Approvals</div>
  {approvalCount > 0 && (
    <a
      href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/editor/${TABLE_ID}?filter=requires_approval%3Deq%3Atrue`}
      target="_blank"
      className="stat-link"
    >
      View in Supabase →
    </a>
  )}
</div>
```

---

## Option 2: Add Simple Approval List

**Create:** `app/squad/components/SimpleApprovalList.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SimpleApprovalList() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchTasks() {
    const { data, error } = await supabase
      .from('squad_tasks')
      .select('*')
      .eq('requires_approval', true)
      .is('approved_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!error && data) {
      setTasks(data)
    }
    setLoading(false)
  }

  async function approveTask(taskId: string) {
    const { error } = await supabase
      .from('squad_tasks')
      .update({
        approved_by: 'Kenny',
        approved_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (!error) {
      fetchTasks()
    }
  }

  async function rejectTask(taskId: string) {
    const reason = prompt('Rejection reason:')
    if (!reason) return

    const { error } = await supabase
      .from('squad_tasks')
      .update({
        status: 'rejected',
        rejected_by: 'Kenny',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', taskId)

    if (!error) {
      fetchTasks()
    }
  }

  if (loading) return <div>Loading approvals...</div>

  if (tasks.length === 0) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded">
        ✅ No pending approvals
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">⏸️ Pending Approvals ({tasks.length})</h3>
      {tasks.map(task => (
        <div key={task.id} className="p-4 bg-yellow-50 border border-yellow-300 rounded">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h4 className="font-semibold">{task.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 rounded">
                  {task.assigned_agent}
                </span>
                <span className="px-2 py-1 bg-purple-100 rounded">
                  {task.priority}
                </span>
                {task.metadata?.email_category && (
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {task.metadata.email_category}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => approveTask(task.id)}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => rejectTask(task.id)}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                ❌ Reject
              </button>
            </div>
          </div>
          {task.deliverable_url && (
            <a
              href={task.deliverable_url}
              target="_blank"
              className="text-blue-500 text-sm mt-2 inline-block"
            >
              👁️ Preview →
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
```

**Add to dashboard:**
```typescript
// In app/squad/page.tsx
import SimpleApprovalList from './components/SimpleApprovalList'

// Add to your page layout
<div className="mt-8">
  <SimpleApprovalList />
</div>
```

---

## Option 3: Use Supabase Directly (No Code)

**Bookmark this Supabase query:**

```
https://supabase.com/dashboard/project/YOUR_PROJECT/editor/TABLE_ID
```

**Filters to set:**
- `requires_approval` = `true`
- `approved_at` = `NULL`

**To approve:**
1. Click the task row
2. Edit `approved_by` = `Kenny`
3. Edit `approved_at` = `NOW()`
4. Save

---

## 📊 Monitoring Dashboard (All-in-One Query)

**Save this as a view or run periodically:**

```sql
-- Create a monitoring view
CREATE OR REPLACE VIEW approval_dashboard AS
SELECT
  'Pending Approvals' as metric,
  COUNT(*) as count
FROM squad_tasks
WHERE requires_approval = true AND approved_at IS NULL

UNION ALL

SELECT
  'Auto-Execute Tasks (Last Hour)',
  COUNT(*)
FROM squad_tasks
WHERE requires_approval = false
  AND created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Dry-Run Executions (Last Hour)',
  COUNT(*)
FROM squad_messages
WHERE message LIKE '%DRY RUN%'
  AND created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Tasks Executed (Last Hour)',
  COUNT(*)
FROM squad_tasks
WHERE execution_attempts > 0
  AND last_execution_attempt > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Failed Tasks',
  COUNT(*)
FROM squad_tasks
WHERE execution_attempts >= 3
  AND status != 'completed';

-- Query it
SELECT * FROM approval_dashboard;
```

**Expected output:**
```
Pending Approvals              | 2
Auto-Execute Tasks (Last Hour) | 5
Dry-Run Executions (Last Hour) | 5
Tasks Executed (Last Hour)     | 7
Failed Tasks                   | 0
```

---

## 🎯 Recommended Testing Flow

1. **Monitor via SQL** - Run queries every hour to see activity
2. **Check Vercel logs** - See dry-run messages in real-time
3. **Test with inquiry email** - Should auto-execute (dry-run)
4. **Test with complaint email** - Should require approval
5. **Approve via SQL** - Update approved_at column
6. **Verify execution** - Check squad_messages for dry-run log

**When comfortable:**
- Keep `AGENT_DRY_RUN=true`
- Set `ENABLE_AUTO_EXECUTION=true`
- Test for 48 hours
- Then switch to `AGENT_DRY_RUN=false` for production

---

This way you can fully test Phase 1 & 2 without building Phase 6 UI first! 🚀
