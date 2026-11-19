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
  // A photo uploaded in this session isn't on lidr.io yet, so preview it from
  // the uploaded file itself; published photos use their normal address.
  var objectUrls = new WeakMap();
  function coverSrc(asset) {
    if (asset.fileObj) {
      if (!objectUrls.has(asset.fileObj)) objectUrls.set(asset.fileObj, URL.createObjectURL(asset.fileObj));
      return objectUrls.get(asset.fileObj);
    }
    return asset.toString();
  }
  var PostPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var get = function (k) { return entry.getIn(["data", k]); };
      var cover = get("cover");
      var coverAsset = cover ? this.props.getAsset(cover) : null;
      var updated = get("updated");
      return h(
        "article",
        { className: "post" },
        get("draft") ? h("p", { className: "notice" }, "Hidden: this post won't appear on lidr.io while 'Hide this post' is on.") : null,
        get("redirectTo") ? h("p", { className: "notice" }, "Retired: visitors will be sent to " + get("redirectTo")) : null,
        h("p", { className: "crumb" }, "Blog"),
        h("h1", { className: "title" }, get("title") || "Untitled post"),
        h("div", { className: "bar" }),
        h("p", { className: "meta" }, formatDate(get("date")), updated ? h("span", null, "Updated " + formatDate(updated)) : null),
        coverAsset ? h("img", { className: "cover", src: coverSrc(coverAsset), alt: get("coverAlt") || "" }) : null,
        h("div", { className: "prose" }, this.props.widgetFor("body"))
      );
    },
  });
  CMS.registerPreviewTemplate("blog", PostPreview);
})();
