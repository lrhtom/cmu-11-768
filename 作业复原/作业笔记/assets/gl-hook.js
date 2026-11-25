/* 术语卡片：作业笔记的正文是 JS 渲染的，走读和图解还会换内容，所以跟着 DOM 变化重新标。
 * 舞台、代码区、图解画布不标，那里的位置是算出来的，多一层 span 会打乱布局。 */
(function () {
  var main = document.querySelector('main');
  if (!main || !window.GL) return;
  var box = main, timer = 0;
  var ob = new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(run, 350); });
  function run() {
    ob.disconnect();
    GL.apply(box);
    ob.observe(box, { childList: true, subtree: true });
  }
  run();
})();
