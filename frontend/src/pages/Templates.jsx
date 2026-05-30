import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getTemplateCategories,
  getTemplatePacks,
  getTemplates,
  importTemplate,
  importTemplatePack,
} from '../api';

export default function Templates() {
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [packs, setPacks] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryData, templateData, packData] = await Promise.all([
        getTemplateCategories(),
        getTemplates(),
        getTemplatePacks(),
      ]);
      setCategories(categoryData);
      setTemplates(templateData);
      setPacks(packData);
    } catch (err) {
      console.error(err);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((template) => {
      const categoryMatch = !activeCategory || template.category_slug === activeCategory;
      const searchMatch = !term || [template.title, template.description, template.category_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return categoryMatch && searchMatch;
    });
  }, [templates, activeCategory, search]);

  const handleImportTemplate = async (template) => {
    setSavingId(`template-${template.id}`);
    setMessage('');
    try {
      await importTemplate(template.id);
      setMessage(`Added "${template.title}" to your habits.`);
      await loadData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingId('');
    }
  };

  const handleImportPack = async (pack) => {
    setSavingId(`pack-${pack.id}`);
    setMessage('');
    try {
      const result = await importTemplatePack(pack.id);
      setMessage(`Added ${result.habits.length} habits from "${pack.title}".`);
      await loadData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Suggested Habits</h1>
        <p className="mt-1 text-xs text-gray-400">Import curated templates into your private habit list.</p>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600">
          {message}
        </div>
      )}

      <div className="mb-5 grid gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search templates"
          className="min-w-0 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-300 focus:ring-2 focus:ring-brand-200"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory('')}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${!activeCategory ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 border border-surface-200'}`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.slug)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${activeCategory === category.slug ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 border border-surface-200'}`}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>
      </div>

      {packs.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">Featured Packs</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {packs.filter((pack) => pack.is_featured).map((pack) => (
              <article key={pack.id} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">{pack.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{pack.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImportPack(pack)}
                    disabled={savingId === `pack-${pack.id}`}
                    className="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    Add Pack
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pack.templates.map((template) => (
                    <span key={template.id} className="rounded-full bg-surface-100 px-2 py-1 text-[11px] font-semibold text-gray-500">
                      {template.icon} {template.title}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">Templates</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <article key={template.id} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-100 text-xl">
                  {template.icon || '✅'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-gray-800">{template.title}</h3>
                  <p className="mt-1 text-xs text-gray-400">{template.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-600">
                  {template.category_name || 'General'}
                </span>
                <button
                  type="button"
                  onClick={() => handleImportTemplate(template)}
                  disabled={savingId === `template-${template.id}`}
                  className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
