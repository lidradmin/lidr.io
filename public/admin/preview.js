/* Live preview for blog posts in the editor. Mirrors the post page closely
   enough for authors to judge layout; the real page is built by Next.js. */
/* global CMS, createClass, h */
(function () {
  CMS.registerPreviewStyle("/admin/preview.css");
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function formatDate(v) {
    if (!v) return "";
    var p = String(v).slice(0, 10).split("-");
    var m = MONTHS[Number(p[1]) - 1];
    return m ? Number(p[2]) + " " + m + " " + p[0] : String(v);
  }
  // Posts store photos by their public address (/images/blog/<slug>/<file>),
  // but the editor keeps photos uploaded in this session under their place in
  // the content repo (images/<slug>/<file>). Looking a photo up by its public
  // address misses that copy, so the preview showed a broken image until the
  // post was published. Look photos up by their repo path instead.
  var PUBLIC_IMAGE = /^(?:https?:\/\/[^/]+)?\/images\/blog\/([a-z0-9-]+)\/([^?#]+)$/;
  function repoPath(src) {
    var m = PUBLIC_IMAGE.exec(src || "");
    return m ? "images/" + m[1] + "/" + m[2] : null;
  }
  function localSrc(getAsset, src) {
    var path = repoPath(src);
    if (!path) return null;
    var url = String(getAsset(path) || "");
    return url.indexOf("blob:") === 0 ? url : null;
  }
  // The small thumbnail in the form is drawn by the editor, outside this
  // preview, so it can't be given the right address up front. When it fails
  // to load, swap in the uploaded copy using the lookup the preview last had.
  var latestGetAsset = null;
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!latestGetAsset || !img || img.tagName !== "IMG") return;
    var local = localSrc(latestGetAsset, img.getAttribute("src"));
    if (local) img.setAttribute("src", local);
  }, true);
  var PostPreview = createClass({
    // Photos inside the post text are rendered by the editor itself, so swap
    // their addresses after each render.
    componentDidMount: function () { this.fixImages(); },
    componentDidUpdate: function () { this.fixImages(); },
    setRoot: function (el) { this.root = el; },
    fixImages: function () {
      if (!this.root) return;
      var getAsset = this.props.getAsset;
      var imgs = this.root.querySelectorAll(".prose img");
      for (var i = 0; i < imgs.length; i++) {
        var local = localSrc(getAsset, imgs[i].getAttribute("src"));
        if (local && imgs[i].getAttribute("src") !== local) imgs[i].setAttribute("src", local);
      }
    },
    render: function () {
      latestGetAsset = this.props.getAsset;
      var entry = this.props.entry;
      var get = function (k) { return entry.getIn(["data", k]); };
      var cover = get("cover");
      var coverUrl = cover ? localSrc(this.props.getAsset, cover) || String(this.props.getAsset(cover) || "") : null;
      var updated = get("updated");
      return h(
        "article",
        { className: "post", ref: this.setRoot },
        get("draft") ? h("p", { className: "notice" }, "Hidden: this post won't appear on lidr.io while 'Hide this post' is on.") : null,
        get("redirectTo") ? h("p", { className: "notice" }, "Retired: visitors will be sent to " + get("redirectTo")) : null,
        h("p", { className: "crumb" }, "Blog"),
        h("h1", { className: "title" }, get("title") || "Untitled post"),
        h("div", { className: "bar" }),
        h("p", { className: "meta" }, formatDate(get("date")), updated ? h("span", null, "Updated " + formatDate(updated)) : null),
        coverUrl ? h("img", { className: "cover", src: coverUrl, alt: get("coverAlt") || "" }) : null,
        h("div", { className: "prose" }, this.props.widgetFor("body"))
      );
    },
  });
  CMS.registerPreviewTemplate("blog", PostPreview);
})();
