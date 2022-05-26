// from https://gist.github.com/huytd/327e453c95ca3edadb32d0c867e2561b
function textSize(text) {
    var container = d3.select('body').append('svg');
    container.append('text')
             .attr('x', -99999)
             .attr('y', -99999)
             .attr('font-size', 'small')
             .text(text);
    var size = container.node().getBBox();
    container.remove();
    return { width: size.width, height: size.height };
}

function pages_per_day(d) {
    started = d.map(di => dateparse(di.date_started))
    read = d.map(di => dateparse(di.date_read))
    // difference between two dates gives the difference in msecs, so convert it
    // to days (and round, to account for precision issues). we add 1 because
    // e.g., if I finished a book the day I read it, I read it in one day.
    num_days = started.map((di, i) => 1 + Math.round((read[i] - di)) / (1000 * 60 * 60 * 24))
    pg_per_day = d.map((di, i) => di.number_of_pages / num_days[i])
    avg_pg_per_day = d3.mean(pg_per_day)
    return avg_pg_per_day
}

function get_y() {
    y_name = d3.select("#bar_y_select").property('value')
    if (y_name === 'pages') {
        return d => d3.sum(d.map(di => di.number_of_pages))
    } else if (y_name === 'pages_per_day') {
        return d => pages_per_day(d)
    } else if (y_name === 'books') {
        return d => d.length
    }
}

function PivotBooks(data, {
    z = get_z('bar'),
    y = get_y(),
} = {}) {
    rolled = d3.flatRollup(data, y, d => d3.timeYear(dateparse(d.date_started)), z)
    // we want this in reverse chronological order
    return rolled.sort((x, y) => x[0].getTime() - y[0].getTime()).reverse()
}

function GroupedBarChart(data, {
    marginTop = 20, // top margin, in pixels
    marginRight = 20, // right margin, in pixels
    marginBottom = 25, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    height_per_year = 140,
    year_padding = 5,
    yType = d3.scaleLinear, // type of y-scale
    bar_width = 25, // width of each bar
    zPadding = 0.05, // amount of x-range to reserve to separate bars
    yFormat, // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
    scatterplot_padding = 1.5, // padding used in the scatterplot, used to offset cells so they line up
} = {}) {
    // remove all children so we can redraw it from fresh
    d3.select('#bar').selectAll('*').remove()
    // get scatter data
    var point_value_data = d3.map(data, get_z('bar'))
    var point_year_data = d3.map(data, d => d3.timeYear(dateparse(d.date_started)))
    // Compute values.
    //
    // first entry will always be years, which we want one per row. Each of the
    // following will be an array of arrays, with each row represented as a
    // different value in the array (e.g., Y[0] is the array of X values for the first row)
    var grouped_data = d3.groups(PivotBooks(data), d => d[0])
    const Rows = d3.map(grouped_data, d => d[0])
    // last entry will always be how we rolled up the books (e.g., count)
    var Y = d3.map(grouped_data, d => d3.map(d[1], d => d.slice(-1)[0]));
    // and second entry will be the other column we're facetting on
    var Z = d3.map(grouped_data, d => d3.map(d[1], d => d[1]));

    // Compute default domains, and unique the x- and z-domains.
    yDomain = [0, d3.max(Y.flat())];
    [zScale, zDomain] = get_colormap(data, 'bar');

    const I = d3.range(d3.max(Y, y => y.length))

    var height = marginBottom + height_per_year * Rows.length + marginTop
    var yRange = [height_per_year - year_padding, 0] // [ymin, ymax]

    var width = bar_width * zDomain.length;
    var zRange = [0, width] // [xmin, xmax]

    // Construct scales, axes, and formats. xzScales and yScales are arrays
    // of scales, but each scale is identical (because we want them to have same range)
    var xzScales = Z.map(Z => d3.scaleBand(zDomain, zRange).padding(zPadding));
    var yScales = Y.map(Y => yType(yDomain, yRange));
    var xAxis = d3.axisBottom(xzScales[0]).tickSizeOuter(0);
    var yAxis = d3.axisLeft(yScales[0]).ticks(height_per_year / 60, yFormat);

    // want to make sure svg element is wide enough for the title
    full_width = d3.max([width + marginLeft + marginRight, textSize(yLabel).width]);
    const svg = d3.select("#bar")
                  .attr("width", full_width)
                  .attr("height", height)
                  .attr("viewBox", [-marginLeft, 0, full_width, height])
                  .attr("style", "max-width: 100%; height: auto; height: intrinsic;");


    svg.append("g")
       .selectAll("g")
       .data(yScales)
       .join('g')
       .attr('transform', (d, i) => `translate(0, ${i * height_per_year + marginTop - scatterplot_padding})`)
       .each(function(yScale) { return d3.select(this).call(yAxis.scale(yScale)); })
       .call(g => g.select(".domain").remove())
       .call(g => g.selectAll(".tick line").clone()
                   .attr("x2", width)
                   .attr("stroke-opacity", 0.1))
       .call(g => g.append("text")
                   .attr("x", -marginLeft)
                   .attr("y", 0)
                   .attr("fill", "black")
                   .attr("text-anchor", "start")
                   .attr('font-size', 'small')
                   .text((d, i) => i==0 ? yLabel: null))


    const cell = svg.append('g')
                    .selectAll('g')
                    .data(d3.range(Rows.length))
                    .join('g')
                    .attr('transform', i => `translate(0, ${i * height_per_year + marginTop - scatterplot_padding})`)

    cell.each(function(row_j) {
        d3.select(this).selectAll('rect')
          .data(I)
          .join('rect')
          .attr('class', 'bar')
          .attr("x", i => xzScales[row_j](Z[row_j][i]))
          .attr("y", i => yScales[row_j](Y[row_j][i]))
          .attr("width", xzScales[row_j].bandwidth())
          .attr("height", i => yScales[row_j](0) - yScales[row_j](Y[row_j][i]))
          .attr("fill", i => zScale(Z[row_j][i]))
          .on("mouseover", (event, i) => update_tooltip(grouped_data[row_j][1][i],
                                                        xzScales[row_j](Z[row_j][i]),
                                                        row_j * height_per_year + marginTop - scatterplot_padding + yScales[row_j](Y[row_j][i])))
          .on("mouseout", () => hide_tooltip())
    })

    function update_tooltip(d, x, y) {
        tooltip.attr('display', null)
        tooltip.attr('transform', `translate(${x},${y})`)
        tt_padding = 10
        elements = []
        elements.push(d3.select('#type').text(d[1]))
        if (Number.isInteger(d[2])) {
            elements.push(d3.select('#value').text(d[2]))
        } else {
            elements.push(d3.select('#value').text(d[2].toFixed(2)))
        }
        d3.select('#tooltip-rect-bar').attr('width', d3.max(elements.map(elt => elt.node().getBBox().width))+tt_padding)
        d3.select('#tooltip-rect-bar').attr('x', d3.min(elements.map(elt => elt.node().getBBox().x))-tt_padding/2)
        if (x + Number(d3.select('#tooltip-rect-bar').attr('width')) + marginLeft > Number(svg.attr('width'))) {
            d3.select('.tooltip-bar').attr('text-anchor', 'end')
        } else {
            d3.select('.tooltip-bar').attr('text-anchor', 'start')
        }
        // need to check this again after potentially updating the text-anchor
        d3.select('#tooltip-rect-bar').attr('x', d3.min(elements.map(elt => elt.node().getBBox().x))-tt_padding/2)
        if (y - d3.select('#tooltip-rect-bar').attr('height') < 0) {
            y = y + Number(d3.select('#tooltip-rect-bar').attr('height'))
            // just so we're not directly on top fo the bar
            x = x + Number(d3.select('#tooltip-rect-bar').attr('height')) / 3
        }
        // we may have updated y, s run this again
        tooltip.attr('transform', `translate(${x},${y})`)
        d3.selectAll('.bar')
          .attr('fill-opacity', (i, j) => (grouped_data[Math.floor(j/I.length)][0].getTime() == d[0].getTime() && grouped_data[Math.floor(j/I.length)][1][i] && grouped_data[Math.floor(j/I.length)][1][i][1]) == d[1] ? 1 : .1)
        d3.selectAll('circle')
          .attr('fill-opacity', i => point_value_data[i] == d[1] && point_year_data[i].getTime() == d[0].getTime() ? 1 : .1)
        d3.selectAll('.connect')
          .attr('stroke-opacity', i => point_value_data[i] == d[1] && point_year_data[i].getTime() == d[0].getTime() ? 1 : .1)
        d3.selectAll('.year-start')
          .attr('stroke-opacity', i => point_value_data[i] == d[1] && point_year_data[i].getTime() == d[0].getTime() ? 1 : .1)
    };

    function hide_tooltip() {
        tooltip.attr('display', 'none')
        d3.selectAll('.bar')
          .attr('fill-opacity', 1)
        d3.selectAll('circle')
          .attr('fill-opacity', 1)
        d3.selectAll('.connect')
          .attr('stroke-opacity', 1)
        d3.selectAll('.year-start')
          .attr('stroke-opacity', 1)
    }

    var tooltip = svg.append('g')
                     .attr('class', 'tooltip-bar')
                     .attr('display', 'none')
                     .attr('pointer-events', 'none')
                     .attr('font-family', 'sans-serif')
                     .attr('font-size', '10')
                     .attr('text-anchor', 'start')

    tooltip.append('rect')
           .attr('id', 'tooltip-rect-bar')
           .style('fill', 'white')
           .attr('y', '-40')
           .attr('height', '35')
           .style('stroke', 'black')
    tooltip.append('text')
           .attr('id', 'type')
           .attr('y', '-24')
    tooltip.append('text')
           .attr('id', 'value')
           .attr('y', '-12')

    // just redraw everything whenever we change z
    d3.select('#bar_z_select')
      .on('change', () => GroupedBarChart(data, {
          marginTop: marginTop,
          marginRight: marginRight,
          marginBottom: marginBottom,
          marginLeft: marginLeft,
          height_per_year: height_per_year,
          year_padding: year_padding,
          yType: yType,
          bar_width: bar_width,
          zPadding: zPadding,
          yFormat: yFormat,
          yLabel: yLabel,
          scatterplot_padding: scatterplot_padding,
      }))

    // just redraw everything whenever we change y
    d3.select('#bar_y_select')
      .on('change', () => GroupedBarChart(data, {
          marginTop: marginTop,
          marginRight: marginRight,
          marginBottom: marginBottom,
          marginLeft: marginLeft,
          height_per_year: height_per_year,
          year_padding: year_padding,
          yType: yType,
          bar_width: bar_width,
          zPadding: zPadding,
          yFormat: yFormat,
          yLabel: yLabel,
          scatterplot_padding: scatterplot_padding,
      }))

    svg.append("g")
       .attr("transform", `translate(0,${height - marginBottom - 2*scatterplot_padding})`)
       .call(xAxis)
       .selectAll('text')
       .attr('y', 0)
       .attr('dy', '.35em')
       .attr('x', 9)
       .style('text-anchor', 'start')
       .attr('transform', 'rotate(90)')

    function lock_input() {
        let inputVal = document.getElementById("lock_check").checked;
        if (inputVal) {
            if (d3.select('#scatter_z_select').property('value') != d3.select('#bar_z_select').property('value')) {
                d3.select('#bar_z_select').property('value', d3.select('#scatter_z_select').property('value'))
                GroupedBarChart(data, {
                    marginTop: marginTop,
                    marginRight: marginRight,
                    marginBottom: marginBottom,
                    marginLeft: marginLeft,
                    height_per_year: height_per_year,
                    year_padding: year_padding,
                    yType: yType,
                    bar_width: bar_width,
                    zPadding: zPadding,
                    yFormat: yFormat,
                    yLabel: yLabel,
                    scatterplot_padding: scatterplot_padding,
                })
            }
            d3.select('#bar_z_select').attr('disabled', 'disabled')
            d3.select('#lock_label').attr('class', 'clicked')
        } else {
            d3.select('#bar_z_select').attr('disabled', null)
            d3.select('#lock_label').attr('class', 'unclicked')
        }
    }

    d3.select('#lock_check')
      .on('click', () => lock_input())

    return Object.assign(svg.node(), {scales: {color: zScale}});
}
