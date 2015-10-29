function formatResult(result) {
  if ($.isArray(result)) {
    result = $.grep(result, function(el, idx) { return Boolean(el != "") });
    var ret = result.join(", ");
  } else {
    var ret = result;
  }

  return String(ret).replace(/\n/g, ", ");
}

var escapes = {
  ".": "\u2024",
  "@": " AT ",
  "http://": "",
  "https://": "",
}

function formatForClipboard(data) {
  if ($.isArray(data) && data.length > 1) {
    var output = Array();

    $.each(data, function(idx, val) {
      output.push("'" + val + "'");
    });

    output = "(" + output.join(", ") + ")";
  } else {
    if ($.isArray(data)) {
      data = data[0];
    }

    var output = String(data);
  }

  $.each(escapes, function(search, replace) {
    var re = new RegExp(search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "g");

    output = output.replace(re, replace);
  })

  return output.replace(/\n/g, ", ");;
}

var client = new ZeroClipboard($("#copyToClipboard"));

client.on("copy", function(e) {
  var clipContents = $("#copyPaste").val();
  var clipboard = e.clipboardData;
  clipboard.setData("text/plain", clipContents);
  //console.log(clipContents);
})

$("#machinaeForm").on("submit", function(event) {
  event.preventDefault();
  var target = $("#target").val();

  if (target == "") {
    target = "testme.machinae-app.io"
  }

  $.ajax({
    type: "GET",
    url: "//api.machinae-app.io/" + target,
    timeout: 30000,
    beforeSend: function(xhr, settings) {
      $("#machinaeModalTitle").text("Processing...");

      $("#progress").show();
      $("#modalTabs").hide();
      $("#modalTabContents").hide();
      $("#copyToClipboard").hide();
      $("#machinaeModal").modal();
    },
    error: function(xhr, status, error) {
      $("#modalTabs").empty();
      $("#modalTabContents").empty();

      var errorResponse = $("<div>").attr({
        class: "alert alert-danger"
      }).append("An error occurred - " + error);

      // Append tab
      $("#modalTabs").append(
        $("<li>").attr({
          role: "presentation"
        }).append(
          $("<a>").attr({
            href: "#errorResults",
            'aria-controls': "settings",
            role: "tab",
            'data-toggle': "tab",
            id: "tab_errorResults"
          }).append("Error")
        )
      );

      // Append tab panel
      $("#modalTabContents").append(
        $("<div>").attr({
          role: "tabpanel",
          class: "tab-pane",
          id: "errorResults"
        }).append(errorResponse)
      );

      // Activate tab
      $("#tab_errorResults").tab("show");

      $("#machinaeModalTitle").text("Error occurred while analyzing " + target);
      $("#progress").hide();
      $("#modalTabs").show();
      $("#modalTabContents").show();
    },
    success: function(response) {
      $("#modalTabs").empty();
      $("#modalTabContents").empty();

      $("#copyPaste").empty();

      var clipboard = $("#copyPaste");
      var starLine = Array(80).join("*");

      clipboard.append(starLine + "\n");
      clipboard.append("Information for " + formatForClipboard(target) + "\n");
      clipboard.append(starLine + "\n");
      clipboard.append("* These characters are escaped in the output below:\n");
      $.each(escapes, function(find, replace) {
        clipboard.append("* '" + find + "' replaced with '" + replace + "'\n");
      })
      clipboard.append("* Do not click any links you find below\n");
      clipboard.append(starLine + "\n\n");

      $.each(response, function(idx, item) {
        var siteName = item.site;
        var tabName = siteName.toLowerCase().replace(/ /g, "_")

        if ($.isEmptyObject(item.results)) {
          var modalTable = $("<div>").attr({
            class: "alert alert-danger"
          }).append("No results found");

          clipboard.append("[-] No " + siteName + " results\n")
        } else {
          clipboard.append("[+] " + siteName + " results\n")

          var modalTable = $("<dl>").attr({
            class: "dl-horizontal",
          });

          $.each(item.results, function(pretty_name, value) {
            if ($.isArray(value)) {
              var cellContents = $("<ul>").attr({
                class: "list-unstyled"
              });
              $.each(value, function(idxx, row) {
                if (row != "") {
                  cellContents.append(
                    $("<li>").append(formatResult(row))
                  );
                  clipboard.append("    [-] " + pretty_name + ": " + formatForClipboard(row) + "\n");
                }
              });
            } else {
              var cellContents = formatResult(value);
              clipboard.append("    [-] " + pretty_name + ": " + formatForClipboard(value) + "\n");
            }
            modalTable.append(
              $("<dt>").append(pretty_name),
              $("<dd>").append(cellContents)
            );
          });
        }

        // Append tab
        $("#modalTabs").append(
          $("<li>").attr({
            role: "presentation"
          }).append(
            $("<a>").attr({
              href: "#" + tabName,
              'aria-controls': "settings",
              role: "tab",
              'data-toggle': "tab",
              id: "tab_" + tabName
            }).append(siteName)
          )
        );

        // Append tab panel
        $("#modalTabContents").append(
          $("<div>").attr({
            role: "tabpanel",
            class: "tab-pane",
            id: tabName
          }).append(modalTable)
        );

        // If this is the first tab, activate it
        if (idx == 0) {
          $("#tab_" + tabName).tab("show");
        }
      })

      $("#machinaeModalTitle").text("Results for: " + target);
      $("#progress").hide();
      $("#copyToClipboard").show();
      $("#modalTabs").show();
      $("#modalTabContents").show();
    }
  })
});

$("#target").popover({
  content: "Enter the target you'd like to analyze. \
    This could be an IP address, a domain, an SSL cert, \
    an email address, or a URL. Enter 'testme.machinae-app.io' \
    to see an example.",
  placement: "left",
  title: "Target",
  trigger: "focus"
})
