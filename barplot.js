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


function PivotBooks(data) {
    return d3.flatRollup(data, d=> d.length, d => d3.timeYear(dateparse(d.date_started)), d => d.fiction)
}

function GroupedBarChart(data, {
    marginTop = 20, // top margin, in pixels
    marginRight = 0, // right margin, in pixels
    marginBottom = 25, // bottom margin, in pixels
    marginLeft = 40, // left margin, in pixels
    height_per_year = 140,
    year_padding = 5,
    yType = d3.scaleLinear, // type of y-scale
    yDomain, // [ymin, ymax]
    zDomain, // array of z-values
    bar_width = 25, // width of each bar
    zPadding = 0.05, // amount of x-range to reserve to separate bars
    yFormat, // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
    colors, // array of colors
    scatterplot_padding = 1.5, // padding used in the scatterplot, used to offset cells so they line up
} = {}) {
    // Compute values.
    //
    // first entry will always be years, which we want one per row. Each of the
    // following will be an array of arrays, with each row represented as a
    // different value in the array (e.g., Y[0] is the array of X values for the first row)
    const grouped_data = d3.groups(data, d => d[0])
    const Rows = d3.map(grouped_data, d => d[0])
    // last entry will always be how we rolled up the books (e.g., count)
    const Y = d3.map(grouped_data, d => d3.map(d[1], d => d.slice(-1)[0]));
    // and second entry will be the other column we're facetting on
    const Z = d3.map(grouped_data, d => d3.map(d[1], d => d[1]));

    // Compute default domains, and unique the x- and z-domains.
    if (yDomain === undefined) yDomain = [0, d3.max(Y.flat())];
    if (zDomain === undefined) zDomain = Z.flat();
    zDomain = new d3.InternSet(zDomain);

    // Omit any data not present in both the x- and z-domain.
    const I = d3.range(Y[0].length)

    var height = marginBottom + height_per_year * Rows.length + marginTop
    var yRange = [height_per_year - year_padding, 0] // [ymin, ymax]

    var width = bar_width * zDomain.size;
    var zRange = [0, width] // [xmin, xmax]

    // Chose a default color scheme based on cardinality.
    if (colors === undefined) colors = d3.schemeSpectral[zDomain.size];
    if (colors === undefined) colors = d3.quantize(d3.interpolateSpectral, zDomain.size);
    // Construct scales, axes, and formats. xzScales and yScales are arrays
    // of scales, but each scale is identical (because we want them to have same range)
    const xzScales = Z.map(Z => d3.scaleBand(zDomain, zRange).padding(zPadding));
    const yScales = Y.map(Y => yType(yDomain, yRange));
    const zScale = d3.scaleOrdinal(zDomain, colors);
    const xAxis = d3.axisBottom(xzScales[0]).tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScales[0]).ticks(height_per_year / 60, yFormat);

    // want to make sure svg element is wide enough for the title
    full_width = d3.max([width + marginLeft + marginRight, textSize(yLabel).width]);
    console.log(width, full_width)
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
          .data(I.filter(i => !isNaN(Y[row_j][i])))
          .join('rect')
            .attr("x", i => xzScales[row_j](Z[row_j][i]))
            .attr("y", i => yScales[row_j](Y[row_j][i]))
            .attr("width", xzScales[row_j].bandwidth())
            .attr("height", i => yScales[row_j](0) - yScales[row_j](Y[row_j][i]))
            .attr("fill", i => zScale(Z[row_j][i]))
    })

    return Object.assign(svg.node(), {scales: {color: zScale}});
}
