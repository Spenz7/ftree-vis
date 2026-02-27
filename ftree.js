$(document).ready(docMain);

var conf = new Object();
conf['depth'] = 3;
conf['width'] = 8;
conf['oversubRatio'] = 2;        // 1 = full bisection, 2 = 2:1, etc.
conf['gpuRackRatio'] = 0.3;      // fraction of racks GPU-heavy
conf['gpuTrafficMultiplier'] = 3; // traffic multiplier for GPU racks

var controlVisible = true;

function docMain() {
    formInit();
    redraw();
    $(document).keypress(kpress);
}

function kpress(e) {
    if (e.which == 104) { // 'h'
        controlVisible = !controlVisible;
        $("div.control").toggle();
    }
}

function redraw() {
    drawFatTree(conf['depth'], conf['width']);
}

function drawFatTree(depth, width) {
    var k = Math.floor(width / 2);
    var padg = 13;
    var padi = 12;
    var hline = 70;
    var hhost = 50;

    var podw = 8;
    var podh = 8;
    var hostr = 2;

    var kexp = function (n) { return Math.pow(k, n); };

    d3.select("svg.main").remove();   
    if (kexp(depth - 1) > 1500 || depth <= 0 || k <= 0) {
        return;
    }

    var w = kexp(depth - 1) * padg + 200;
    var h = (2 * depth) * hline;

    var svg = d3.select("body").append("svg")
        .attr("width", w)
        .attr("height", h)
        .attr("class", "main")
        .append("g")
        .attr("transform", "translate(" + w/2 + "," + h/2 + ")");

    var linePositions = [];

    function podPositions(d) {
        var ret = [];
        var ngroup = kexp(d);
        var pergroup = kexp(depth - 1 - d);
        var wgroup = pergroup * padg;
        var wgroups = wgroup * (ngroup - 1);
        var offset = -wgroups/2;

        for (var i = 0; i < ngroup; i++) {
            var wpods = pergroup * padi;
            var goffset = wgroup * i - wpods/2;
            for (var j = 0; j < pergroup; j++) {
                ret.push(offset + goffset + padi * j);
            }
        }

        return ret;
    }

    for (var i = 0; i < depth; i++) linePositions[i] = podPositions(i);

    function drawPods(list, y) {
        for (var j = 0, n = list.length; j < n; j++) {
            svg.append("rect")
                .attr("class", "pod")
                .attr("width", podw)
                .attr("height", podh)
                .attr("x", list[j] - podw/2)
                .attr("y", y - podh/2);
        }
    }

    function drawHost(x, y, dy, dx) {
        svg.append("line")
            .attr("class", "cable")
            .attr("x1", x)
            .attr("y1", y)
            .attr("x2", x + dx)
            .attr("y2", y + dy);

        svg.append("circle")
            .attr("class", "host")
            .attr("cx", x + dx)
            .attr("cy", y + dy)
            .attr("r", hostr);
    }

    function drawHosts(list, y, direction) {
        for (var i = 0; i < list.length; i++) {
            if (k == 1) {
                drawHost(list[i], y, hhost * direction, 0);
            } else if (k == 2) {
                drawHost(list[i], y, hhost * direction, -2);
                drawHost(list[i], y, hhost * direction, +2);
            } else if (k == 3) {
                drawHost(list[i], y, hhost * direction, -4);
                drawHost(list[i], y, hhost * direction, 0);
                drawHost(list[i], y, hhost * direction, +4);
            } else {
                drawHost(list[i], y, hhost * direction, -4);
                drawHost(list[i], y, hhost * direction, 0);
                drawHost(list[i], y, hhost * direction, +4);
            }
        }
    }

    function linePods(d, list1, list2, y1, y2) {
        var pergroup = kexp(depth - 1 - d);
        var ngroup = kexp(d);
        var perbundle = pergroup / k;

        for (var i = 0; i < ngroup; i++) {
            var offset = pergroup * i;
            for (var j = 0; j < k; j++) {
                var boffset = perbundle * j;
                for (var t = 0; t < perbundle; t++) {
                    var ichild = offset + boffset + t;
                    for (var d = 0; d < k; d++) {
                        var ifather = offset + perbundle * d + t;
                        svg.append("line")
                            .attr("class", "cable")
                            .attr("x1", list1[ifather])
                            .attr("y1", y1)
                            .attr("x2", list2[ichild])
                            .attr("y2", y2);
                    }
                }
            }
        }
    }

    for (var i = 0; i < depth - 1; i++) {
        linePods(i, linePositions[i], linePositions[i + 1], i * hline, (i + 1) * hline);
        linePods(i, linePositions[i], linePositions[i + 1], -i * hline, -(i + 1) * hline);
    }

    drawHosts(linePositions[depth - 1], (depth - 1) * hline, 1);
    drawHosts(linePositions[depth - 1], -(depth - 1) * hline, -1);

    for (var i = 0; i < depth; i++) {
        if (i == 0) {
            drawPods(linePositions[0], 0);
        } else {
            drawPods(linePositions[i], i * hline);
            drawPods(linePositions[i], -i * hline);
        }
    }

    updateStat();
}

function updateStat() {
    var w = Math.floor(conf['width'] / 2);
    var d = conf['depth'];
    if (d == 0 || w == 0) {
        ["nhost","nswitch","ncable","ntx","nswtx","minpaths","effbw","aistress"].forEach(id => d3.select("#"+id).html("&nbsp;"));
        return;
    }

    var line = Math.pow(w, d - 1);

    var nhost = 2 * line * w;
    var nswitch = (2 * d - 1) * line;
    var ncable = (2 * d) * w * line;
    var ntx = 2 * (2 * d) * w * line;
    var nswtx = ntx - nhost;

    // === Extra AI / Oversub metrics ===
    var minimalPaths = Math.pow(w, 2);
    var effectiveBW = nswtx / conf['oversubRatio'];
    var avgBWPerHost = effectiveBW / nhost;
    var congestionIndex = (conf['gpuRackRatio'] * conf['gpuTrafficMultiplier']) / avgBWPerHost;

    d3.select("#nhost").html(formatNum(nhost));
    d3.select("#nswitch").html(formatNum(nswitch));
    d3.select("#ncable").html(formatNum(ncable));
    d3.select("#ntx").html(formatNum(ntx));
    d3.select("#nswtx").html(formatNum(nswtx));
    d3.select("#minpaths").html(formatNum(minimalPaths));
    d3.select("#effbw").html(formatNum(Math.floor(effectiveBW)));
    d3.select("#aistress").html(congestionIndex.toFixed(4));
}

function formatNum(x) {
    x = x.toString();
    var pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x))
        x = x.replace(pattern, "$1,$2");
    return x;
}

function formInit() {
    var form = d3.select("form");

    function confInt() { 
        conf[this.name] = parseFloat(this.value); 
        updateStat();
        redraw();
    }

    function hook(name, func) {
        var fields = form.selectAll("[name=" + name + "]");
        fields.on("change", func);
        fields.each(func);
    }

    ["depth","width","oversubRatio","gpuRackRatio","gpuTrafficMultiplier"].forEach(name => hook(name, confInt));
}
