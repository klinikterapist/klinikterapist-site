/**
 * Blog search in the visitor's browser (spec §5.8: no server). foldTr is the one text-folding rule;
 * the inline page script embeds this same function through its source text, so there is no second copy.
 */

/**
 * Lowercase with Turkish rules (İ → i, I → ı), strip accents (ş → s, ğ → g, ö → o …) and map the
 * dotless ı to i, so "İLİŞKİ", "ilişki" and "iliski" (and "KAYGI", "kaygı", "kaygi") all match.
 * Self-contained on purpose: it is serialised into the page script.
 */
export function foldTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // the accent marks NFD split off
    .replace(/ı/g, 'i'); // dotless ı
}

/**
 * The inline script of the blog list. Inside `[data-blog]` it filters every `[data-post]` element by
 * the search box (folded `data-search` text) and, on the all-posts page (`data-filterable`), by the
 * topic chip clicked (`a[data-cat]`, plain links to the category pages without JavaScript). While a
 * filter is on, `[data-hide-on-filter]` blocks hide and `[data-no-results]` shows when nothing matches.
 * A link with `data-clear-filter` (the Popular chip) clears the filter before it jumps.
 * Plain ES5 text, not a serialised function, so no build helper can leak into it.
 */
export function blogFilterScript(): string {
  return `(function () {
  var fold = ${foldTr.toString()};
  var root = document.querySelector('[data-blog]');
  var input = root && root.querySelector('[data-blog-search] input');
  if (!input) return;
  var cat = '';
  function mark() {
    root.querySelectorAll('a[data-cat]').forEach(function (a) {
      if (a.getAttribute('data-cat') === cat) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  function apply() {
    var q = fold(input.value.trim());
    var any = false;
    root.querySelectorAll('[data-post]').forEach(function (el) {
      var ok = (!cat || el.getAttribute('data-cat') === cat) &&
        (!q || fold(el.getAttribute('data-search') || '').indexOf(q) !== -1);
      el.hidden = !ok;
      if (ok) any = true;
    });
    var on = !!(q || cat);
    root.querySelectorAll('[data-hide-on-filter]').forEach(function (el) { el.hidden = on; });
    var none = root.querySelector('[data-no-results]');
    if (none) none.hidden = any;
  }
  input.form && input.form.addEventListener('submit', function (e) { e.preventDefault(); });
  input.addEventListener('input', apply);
  root.addEventListener('click', function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a') : null;
    if (!a || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (a.hasAttribute('data-clear-filter')) {
      input.value = '';
      cat = '';
      mark();
      apply();
      return;
    }
    if (!a.hasAttribute('data-cat') || !root.hasAttribute('data-filterable')) return;
    e.preventDefault();
    cat = a.getAttribute('data-cat') || '';
    mark();
    apply();
  });
  if (input.value) apply();
})();`;
}
