// Form Responses - view, export, archive and delete submissions to Custom Form newsletter sections
import AdminNav from './AdminNav';
import { useEffect, useRef, useState } from 'react';

import { apiNewsletters, apiNewsletterGet, apiNewsletterUpdate, apiFormResponses, apiFormResponseToggleReviewed, apiFormResponseDelete, apiFormDelete } from '../../api/client';
import { useMemberAuth } from '../../context/MemberAuthContext';
import { exportToCSV } from '../../utils/csvExport';
import PollsAndRsvps from './PollsAndRsvps';

// CSV cells only get quoted (by exportToCSV) when they contain a comma, and quotes inside
// them aren't escaped — sanitize free-text answers so exported files stay valid.
const sanitizeForCSV = (value) => String(value ?? '').replace(/\"/g, "'").replace(/\r?\n/g, ' | ');

const formKey = (form) => `${form.newsletterId}__${form.sectionId}`;

// The worker has no per-response setting store, so the "I've checked this form" archive
// flags live in the browser (keyed by the single church space) exactly like column widths.
const ARCHIVE_STORAGE_KEY = 'church:formResponsesArchive';

const loadArchivedMap = () => {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || '{}')?.archivedForms || {};
  } catch {
    return {};
  }
};
const saveArchivedMap = (map) => {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify({ archivedForms: map }));
  } catch {
    // storage unavailable - archive state just won't be remembered
  }
};

// Responses table column sizing (px). Answer columns are drag-resizable.
const CHECK_COL_WIDTH = 48;
const ACTION_COL_WIDTH = 90;
const DEFAULT_COL_WIDTH = 180;
const MIN_COL_WIDTH = 80;
const SUBMITTED_KEY = '__submitted';

const FormResponses = () => {
  const { memberProfile } = useMemberAuth();
  const memberId = 'church';

  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [selectedForm, setSelectedForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [archivedKeys, setArchivedKeys] = useState(() => new Set());
  const [showArchived, setShowArchived] = useState(false);
  // { type: 'form' | 'response', response? } - what the confirmation box is asking about
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [columnWidths, setColumnWidths] = useState({});
  const columnWidthsRef = useRef({});
  columnWidthsRef.current = columnWidths;

  // Column widths are a per-browser convenience, remembered per form.
  const widthsStorageKey = (form) => `formResponsesColumnWidths:${memberId}:${formKey(form)}`;
  const loadColumnWidths = (form) => {
    try {
      return JSON.parse(localStorage.getItem(widthsStorageKey(form))) || {};
    } catch {
      return {};
    }
  };
  const saveColumnWidths = (form, widths) => {
    try {
      localStorage.setItem(widthsStorageKey(form), JSON.stringify(widths));
    } catch {
      // storage unavailable - widths just won't be remembered
    }
  };
  const widthFor = (key) => columnWidths[key] || DEFAULT_COL_WIDTH;

  const startResize = (event, key) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = widthFor(key);
    const form = selectedForm;
    let latest = startWidth;

    const onMove = (moveEvent) => {
      latest = Math.max(MIN_COL_WIDTH, Math.round(startWidth + moveEvent.clientX - startX));
      setColumnWidths(prev => ({ ...prev, [key]: latest }));
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      saveColumnWidths(form, { ...columnWidthsRef.current, [key]: latest });
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const resetColumnWidth = (key) => {
    const next = { ...columnWidths };
    delete next[key];
    setColumnWidths(next);
    saveColumnWidths(selectedForm, next);
  };

  useEffect(() => {
    const loadForms = async () => {
      setLoadingForms(true);
      try {
        try {
          setArchivedKeys(new Set(Object.keys(loadArchivedMap())));
        } catch (error) {
          console.error('Error loading archived forms:', error);
        }

        // Every newsletter's sections live in its content JSON; pull each one in turn so we
        // can discover the Custom Form sections (forms in the new model live with newsletters).
        const list = await apiNewsletters(false);
        const discoveredForms = [];

        for (const nl of list) {
          let data = nl;
          try {
            data = await apiNewsletterGet(nl.id);
          } catch (error) {
            // keep the list row when a full fetch fails so we still render the forms we know about
          }
          const sections = Array.isArray(data.content?.sections) ? data.content.sections : [];
          sections.forEach(section => {
            if (section.type === 'customForm') {
              discoveredForms.push({
                newsletterId: nl.id,
                newsletterName: data.name || data.title || 'Untitled Newsletter',
                sectionId: section.id,
                formId: section.formId || section.id,
                formTitle: section.formTitle || 'Untitled Form',
                fields: section.fields || [],
              });
            }
          });
        }

        setForms(discoveredForms);
      } catch (error) {
        console.error('Error loading forms:', error);
      } finally {
        setLoadingForms(false);
      }
    };

    loadForms();
  }, []);

  const selectForm = async (form) => {
    setSelectedForm(form);
    setColumnWidths(loadColumnWidths(form));
    setResponses([]);
    setLoadingResponses(true);
    try {
      const rows = await apiFormResponses(form.formId || form.sectionId);
      setResponses(rows
        .map(r => ({
          id: String(r.id),
          answers: r.payload || {},
          submittedAt: r.created_at ? { toDate: () => new Date(r.created_at) } : null,
          respondent: r.respondent,
        }))
        .filter(row => row.answers) // ignore legacy/payload-less docs
        .sort((a, b) => (b.submittedAt?.toDate?.()?.getTime() || 0) - (a.submittedAt?.toDate?.()?.getTime() || 0)));
    } catch (error) {
      console.error('Error loading responses:', error);
    } finally {
      setLoadingResponses(false);
    }
  };

  const setArchived = async (form, archived) => {
    setWorking(true);
    setActionError('');
    try {
      const map = loadArchivedMap();
      if (archived) map[formKey(form)] = true;
      else delete map[formKey(form)];
      saveArchivedMap(map);
      setArchivedKeys(prev => {
        const next = new Set(prev);
        if (archived) next.add(formKey(form));
        else next.delete(formKey(form));
        return next;
      });
      // The form moves to the other tab, so drop the selection
      setSelectedForm(null);
      setResponses([]);
    } catch (error) {
      console.error('Error updating archive state:', error);
      setActionError(`Could not ${archived ? 'archive' : 'restore'} this form. Please try again.`);
    } finally {
      setWorking(false);
    }
  };

  // Author-only "I've looked at this one" marker. Optimistic toggle backed by the Worker
  // (form_responses.reviewed). Reverts on error.
  const toggleReviewed = async (response) => {
    const reviewed = !response.reviewed;
    const setReviewedLocally = (value) =>
      setResponses(prev => prev.map(row => (row.id === response.id ? { ...row, reviewed: value } : row)));
    setReviewedLocally(reviewed);
    setActionError('');
    try {
      const res = await apiFormResponseToggleReviewed(response.formId, response.id);
      setReviewedLocally(!!res?.reviewed);
    } catch (error) {
      console.error('Error updating reviewed state:', error);
      setReviewedLocally(!reviewed);
      setActionError('Could not save that checkmark. Please try again.');
    }
  };

  const deleteResponse = async (response) => {
    try {
      await apiFormResponseDelete(response.formId, response.id);
    } catch (error) {
      console.error('Error deleting response:', error);
    }
    setResponses(prev => prev.filter(row => row.id !== response.id));
  };

  // Removes the Custom Form section from the newsletter (its parent), so readers no longer
  // see it. Response rows are dropped from this session's list.
  const deleteForm = async (form) => {
    try {
      const data = await apiNewsletterGet(form.newsletterId);
      if (data && Array.isArray(data.content?.sections)) {
        await apiNewsletterUpdate(form.newsletterId, {
          content: { ...data.content, sections: data.content.sections.filter(s => s.id !== form.sectionId) },
        });
      }
    } catch (error) {
      console.error('Error removing form section from newsletter:', error);
    }
    // Also drop the backend form row (and its responses) if it was persisted with a real id.
    try {
      if (form.formId) await apiFormDelete(form.formId);
    } catch (error) {
      console.error('Error deleting form row from backend:', error);
    }

    const map = loadArchivedMap();
    delete map[formKey(form)];
    saveArchivedMap(map);
    setArchivedKeys(prev => {
      const next = new Set(prev);
      next.delete(formKey(form));
      return next;
    });

    setForms(prev => prev.filter(f => formKey(f) !== formKey(form)));
    setSelectedForm(null);
    setResponses([]);
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setWorking(true);
    setActionError('');
    try {
      if (confirmTarget.type === 'form') await deleteForm(selectedForm);
      else await deleteResponse(confirmTarget.response);
      setConfirmTarget(null);
    } catch (error) {
      console.error('Error deleting:', error);
      setActionError('Delete failed. Nothing more was removed - please try again.');
    } finally {
      setWorking(false);
    }
  };

  // Columns = current form fields, plus any answer keys from historical submissions that
  // no longer match a current field (so older data never silently disappears).
  const getColumns = () => {
    if (!selectedForm) return [];
    const columns = selectedForm.fields.map(field => ({ key: field.id, header: field.label }));
    const knownFieldIds = new Set(selectedForm.fields.map(field => field.id));
    const extraKeys = new Set();
    responses.forEach(response => {
      Object.keys(response.answers || {}).forEach(key => {
        if (!knownFieldIds.has(key)) extraKeys.add(key);
      });
    });
    extraKeys.forEach(key => columns.push({ key, header: `${key} (removed field)` }));
    return columns;
  };

  const visibleForms = forms.filter(form => archivedKeys.has(formKey(form)) === showArchived);
  const archivedCount = forms.filter(form => archivedKeys.has(formKey(form))).length;
  const selectedIsArchived = selectedForm ? archivedKeys.has(formKey(selectedForm)) : false;

  const handleExport = () => {
    const columns = getColumns();
    const data = responses.map(response => {
      const row = { submittedAt: response.submittedAt?.toDate?.().toLocaleString() || '' };
      columns.forEach(col => {
        row[col.key] = sanitizeForCSV(response.answers?.[col.key] || '');
      });
      return row;
    });
    exportToCSV(
      data,
      [{ key: 'submittedAt', header: 'Submitted At' }, ...columns],
      `${(selectedForm.formTitle || 'form').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_responses`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Form Responses</h1>
          <p className="text-gray-600">View and export submissions from Custom Form sections in the newsletters. Poll results and event RSVPs are below.</p>
        </div>

        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          {/* Forms list */}
          <div className="bg-white rounded-xl shadow-md p-4 h-fit">
            <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-lg">
              {[
                { archived: false, label: 'Your Forms' },
                { archived: true, label: `Archived${archivedCount ? ` (${archivedCount})` : ''}` },
              ].map(tab => (
                <button
                  key={tab.label}
                  onClick={() => {
                    setShowArchived(tab.archived);
                    setSelectedForm(null);
                    setResponses([]);
                    setActionError('');
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-md text-sm font-medium transition ${showArchived === tab.archived ? 'bg-white text-church-navy-deep shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {loadingForms ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : visibleForms.length === 0 ? (
              <p className="text-sm text-gray-500">
                {showArchived
                  ? 'No archived forms.'
                  : forms.length === 0
                    ? 'No custom forms yet. Add a "Custom Form" section to a newsletter to get started.'
                    : 'All of your forms are archived.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {visibleForms.map(form => (
                  <li key={formKey(form)}>
                    <button
                      onClick={() => { setActionError(''); selectForm(form); }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition ${selectedForm && formKey(selectedForm) === formKey(form) ? 'bg-church-cream text-church-navy-deep' : 'hover:bg-gray-100 text-gray-700'}`}
                    >
                      <div className="font-medium text-sm">{form.formTitle}</div>
                      <div className="text-xs text-gray-500">{form.newsletterName}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Responses table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {!selectedForm ? (
              <div className="px-6 py-16 text-center text-gray-500">Select a form to view its responses.</div>
            ) : loadingResponses ? (
              <div className="px-6 py-16 text-center text-gray-500">Loading responses...</div>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedForm.formTitle}</h3>
                    <p className="text-sm text-gray-500">
                      {responses.length} response{responses.length === 1 ? '' : 's'}
                      {responses.length > 0 && ` · ${responses.filter(row => row.reviewed).length} checked`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={handleExport}
                      disabled={responses.length === 0}
                      className="px-4 py-2 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => setArchived(selectedForm, !selectedIsArchived)}
                      disabled={working}
                      className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {selectedIsArchived ? 'Restore' : 'Archive'}
                    </button>
                    <button
                      onClick={() => { setActionError(''); setConfirmTarget({ type: 'form' }); }}
                      disabled={working}
                      className="px-4 py-2 bg-white border border-red-300 hover:bg-red-50 text-red-600 rounded-lg font-medium transition disabled:opacity-50"
                    >
                      Delete Form
                    </button>
                  </div>
                </div>
                {actionError && !confirmTarget && (
                  <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">{actionError}</div>
                )}
                {responses.length === 0 ? (
                  <div className="px-6 py-16 text-center text-gray-500">No responses yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table
                      style={{
                        tableLayout: 'fixed',
                        width: CHECK_COL_WIDTH + ACTION_COL_WIDTH + widthFor(SUBMITTED_KEY)
                          + getColumns().reduce((sum, col) => sum + widthFor(col.key), 0),
                      }}
                    >
                      <colgroup>
                        <col style={{ width: CHECK_COL_WIDTH }} />
                        <col style={{ width: widthFor(SUBMITTED_KEY) }} />
                        {getColumns().map(col => (
                          <col key={col.key} style={{ width: widthFor(col.key) }} />
                        ))}
                        <col style={{ width: ACTION_COL_WIDTH }} />
                      </colgroup>
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="pl-6 pr-2 py-4" aria-label="Checked" />
                          {[{ key: SUBMITTED_KEY, header: 'Submitted' }, ...getColumns()].map(col => (
                            <th key={col.key} className="relative px-4 py-4 text-left text-sm font-semibold text-gray-700 break-words">
                              {col.header}
                              <span
                                role="separator"
                                aria-label={`Resize ${col.header} column`}
                                title="Drag to resize, double-click to reset"
                                onPointerDown={(event) => startResize(event, col.key)}
                                onDoubleClick={() => resetColumnWidth(col.key)}
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none border-r border-gray-200 hover:bg-church-border"
                              />
                            </th>
                          ))}
                          <th className="px-4 py-4" />
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map(response => (
                          <tr key={response.id} className={`border-b border-gray-200 ${response.reviewed ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}>
                            <td className="pl-6 pr-2 py-4">
                              <input
                                type="checkbox"
                                checked={!!response.reviewed}
                                onChange={() => toggleReviewed(response)}
                                aria-label="Mark this response as checked"
                                className="h-4 w-4 rounded border-gray-300 text-church-navy focus:ring-church-navy cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600 align-top break-words">
                              {response.submittedAt?.toDate?.().toLocaleString() || '—'}
                            </td>
                            {getColumns().map(col => (
                              <td key={col.key} className="px-4 py-4 text-sm text-gray-800 align-top break-words whitespace-pre-wrap">{response.answers?.[col.key] || ''}</td>
                            ))}
                            <td className="px-4 py-4 text-right whitespace-nowrap align-top">
                              <button
                                onClick={() => { setActionError(''); setConfirmTarget({ type: 'response', response }); }}
                                className="text-sm text-red-600 hover:text-red-800 font-medium transition"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-10">
        {memberId && <PollsAndRsvps memberId={memberId} />}
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirmTarget.type === 'form' ? 'Delete this entire form?' : 'Delete this response?'}
            </h3>
            {confirmTarget.type === 'form' ? (
              <p className="text-sm text-gray-600 mb-4">
                This permanently deletes <strong>{responses.length} response{responses.length === 1 ? '' : 's'}</strong> and
                removes the &quot;{selectedForm?.formTitle}&quot; form from the &quot;{selectedForm?.newsletterName}&quot; newsletter, so
                readers will no longer see it. This cannot be undone. Consider archiving instead.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                This permanently deletes the response submitted
                {confirmTarget.response.submittedAt?.toDate ? ` on ${confirmTarget.response.submittedAt.toDate().toLocaleString()}` : ''}.
                This cannot be undone.
              </p>
            )}
            {actionError && <p className="text-sm text-red-700 mb-4">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setConfirmTarget(null); setActionError(''); }}
                disabled={working}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={working}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {working ? 'Deleting...' : confirmTarget.type === 'form' ? 'Delete Form' : 'Delete Response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormResponses;
