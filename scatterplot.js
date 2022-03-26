function offset(X1, X2, padding, current_offset, years, current_year) {
  const Y = new Array(X1.length).fill(0);
  for (const bi of d3.range(X1.length).sort((i, j) => X1[i] - X1[j])) {
    // we don't compute the offset of any dots that were started last year
    // (they're already included in current_offset)
    if (years[bi] != current_year) {
      continue
    }
    if (X1[bi] > d3.min(current_offset) + padding) {
      // we want to find the index of the first value in current_offset that X1 is greater than
      Y[bi] = current_offset.map(v => X1[bi] > v+padding).indexOf(true);
      current_offset[Y[bi]] = X2[bi];
    } else {
      Y[bi] = current_offset.length;
      current_offset.push(X2[bi]);
    }
  }
  return Y;
}

function format_date(d, begin) {
  dateparse = d3.timeParse('%Y/%m/%d')
  if (begin === true) {
    date = d.date_started
  } else {
    date = d.date_read
  }
  return d3.timeFormat('%b %-d, %Y')(dateparse(date))
}

function Scatterplot(data, {
  x1 = ([x]) => x1, // given d in data, returns the (quantitative) x-value
  x2 = ([x]) => x2, // given d in data, returns the (quantitative) x-value
  y1 = ([, y]) => y1, // given d in data, returns the (quantitative) y-value
  y2 = ([, y]) => y2, // given d in data, returns the (quantitative) y-value
  z = ([z]) => z,
  r = 3, // (fixed) radius of dots, in pixels
  title, // given d in data, returns the title
  marginTop = 20, // top margin, in pixels
  marginRight = 30, // right margin, in pixels
  marginBottom = 30, // bottom margin, in pixels
  marginLeft = 40, // left margin, in pixels
  inset = r * 2, // inset the default range, in pixels
  insetTop = inset, // inset the default y-range
  insetRight = inset, // inset the default x-range
  insetBottom = inset*20, // inset the default y-range, needs to be larger because of how we offset
  insetLeft = inset, // inset the default x-range
  width = 640, // outer width, in pixels
  height = 400, // outer height, in pixels
  xType = d3.scaleLinear, // type of x-scale
  xDomain, // [xmin, xmax]
  xRange = [marginLeft + insetLeft, width - marginRight - insetRight], // [left, right]
  yType = d3.scaleLinear, // type of y-scale
  yDomain, // [ymin, ymax]
  yRange = [height - marginBottom - insetBottom, marginTop + insetTop], // [bottom, top]
  xLabel, // a label for the x-axis
  yLabel, // a label for the y-axis
  xFormat, // a format specifier string for the x-axis
  yFormat, // a format specifier string for the y-axis
  zDomain, // array of z-values
  colors, // color scheme
  fill = "none", // fill color for dots
  stroke = "currentColor", // stroke color for the dots
  strokeWidth = 1.5, // stroke width for dots
  padding = 1.5, // (fixed) padding between the circles
  halo = "#fff", // color of label halo
  haloWidth = 3 // padding around the labels
} = {}) {
  // Compute values.
  const X1 = d3.map(data, x1);
  const X2 = d3.map(data, x2);
  const Y1 = d3.map(data, y1);
  const Y2 = d3.map(data, y2);
  const Z = d3.map(data, z);
  const T = title == null ? null : d3.map(data, title);
  const I = d3.range(X1.length).filter(i => !isNaN(X1[i]) && !isNaN(Y1[i]));
  // Compute default domains.
  if (xDomain === undefined) xDomain = d3.extent(X1);
  if (yDomain === undefined) yDomain = d3.extent(Y1);
  if (zDomain === undefined) zDomain = Z;
  zDomain = new d3.InternSet(zDomain);

  // Chose a default color scheme based on cardinality.
  if (colors === undefined) colors = d3.schemeSpectral[zDomain.size];
  if (colors === undefined) colors = d3.quantize(d3.interpolateSpectral, zDomain.size);
  // Construct scales and axes.
  const xScale = xType(xDomain, xRange);
  // need to pad an extra year for the ticks
  const yScale = yType(yDomain, yRange).nice(d3.min(Y1).getFullYear(), d3.timeYear.count(d3.max(Y1).getFullYear()));
  const xAxis = d3.axisBottom(xScale).ticks(d3.timeMonth.every(1), xFormat);
  const yAxis = d3.axisLeft(yScale).ticks(d3.timeYear.every(1), yFormat);
  const color = d3.scaleOrdinal(zDomain, colors);

  const svg = d3.select("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  function update_tooltip(d, x, y) {
    tooltip.attr('display', null)
    tooltip.attr('transform', `translate(${x},${y})`)
    padding = 10
    elements = []
    elements.push(d3.select('#title').text(d.title))
    elements.push(d3.select('#author').text("by " + d.author))
    elements.push(d3.select('#date_started').text("Started: " + format_date(d, true)));
    elements.push(d3.select('#date_read').text("Finished: " + format_date(d, false)));
    if (x - d3.select('rect').attr('width')/2 < 0) {
      d3.select('.tooltip').attr('text-anchor', 'start')
    } else if (x + d3.select('rect').attr('width')/2 > svg.attr('width')) {
      d3.select('.tooltip').attr('text-anchor', 'end')
    } else {
       d3.select('.tooltip').attr('text-anchor', 'middle')
    }
    d3.select('rect').attr('width', d3.max(elements.map(elt => elt.node().getBBox().width))+padding)
    d3.select('rect').attr('x', d3.min(elements.map(elt => elt.node().getBBox().x))-padding/2)
  };

  svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(xAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
          .attr("y2", marginTop + marginBottom - height)
          .attr("stroke-opacity", 0.1))
      .call(g => g.append("text")
          .attr("x", width)
          .attr("y", marginBottom - 4)
          .attr("fill", "currentColor")
          .attr("text-anchor", "end")
          .text(xLabel));

  svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(yAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick text")
          .attr('dy', -1.5*padding))
      .call(g => g.selectAll(".tick line")
          .attr("y2", -padding*2)
          .attr("y1", -padding*2)
        .clone()
          .attr("y2", -padding*2)
          .attr("y1", -padding*2)
          .attr("x2", width - marginLeft - marginRight)
          .attr("stroke-opacity", 0.4))
      .call(g => g.append("text")
          .attr("x", -marginLeft)
          .attr("y", 10)
          .attr("fill", "currentColor")
          .attr("text-anchor", "start")
          .text(yLabel));

  const g = svg.append("g")

  // Compute the y offsets.
  var unique_times = [...new Set(Y1.map(d => d.getTime()))]
  var Y_dodge = []
  var last_years_offset = []
  // do this separately for each year
  for (var idx = unique_times.length-1; idx >= 0; idx--) {
    // get all books that have either their start or end in this year
    var Y1_mask = Y1.map(d => d.getTime() == unique_times[idx])
    var Y2_mask = Y2.map(d => d.getTime() == unique_times[idx])
    var masked_I = I.filter((v, i) => Y1_mask[i] || Y2_mask[i])
    // get the relevant x position
    var masked_X1 = masked_I.map(i => xScale(X1[i]))
    var masked_Y1 = masked_I.map(i => Y1[i].getTime())
    // if the end of the book isn't this year, use the end of the year
    var masked_X2 = masked_I.map(i => Y1[i].getTime() == Y2[i].getTime() ? xScale(X2[i]) : xScale(new Date('2015/12/31')))
    var masked_T = masked_I.map(i => T[i])
    // for values that show up in both, we want them to have the same offset value already, which is what last_years_offset is for
    var tmp = offset(masked_X1, masked_X2, r*2+padding, last_years_offset, masked_Y1, unique_times[idx]);
    // figure out the indices that correspond to points that either started or ended in a different year
    var masked_I1 = I.filter((v, i) => Y1_mask[i])
    var masked_I2 = I.filter((v, i) => Y2_mask[i])
    var I1_check = masked_I1.map(v => masked_I.indexOf(v))
    var I2_check = masked_I2.map(v => masked_I.indexOf(v))
    // if the book ended in a different year, we want to hold onto its offset
    last_years_offset = tmp.filter((v, i) => !I2_check.includes(i))
    var last_years_offset_idx = tmp.map((v, i) => !I2_check.includes(i))
    last_years_offset_idx = masked_I.filter((v, i) => last_years_offset_idx[i])
    // we need to then create a "fake offset", which includes the portion of the offset array that corresponds
    // to those books that ended in a different year (the rest are negative numbers, so they serve as placeholders)
    var last_yrs_tmp = []
    for (let i = 0; i <= d3.max(last_years_offset); i++) {
      if (last_years_offset.includes(i)) {
        let last_idx = last_years_offset_idx[last_years_offset.indexOf(i)]
        last_yrs_tmp.push(xScale(X2[last_idx]));
      } else  {
        last_yrs_tmp.push(-(r*2+padding));
      }
    }
    last_years_offset = last_yrs_tmp;
    // grab only those values from tmp whose start date are in this year
    tmp = tmp.filter((v, i) => I1_check.includes(i))
    // and multiply the offset by the apprioriate value
    Y_dodge.push(tmp.map(y => (r*2+padding)*y));
  }
  // Y_dodge is an array of arrays, in backwards order, so let's reverse it...
  Y_dodge.reverse()
  // and flatten them out
  Y_dodge = Y_dodge.flat()

  g.selectAll("line")
    .data(I)
    .join('line')
      .attr("stroke", i => color(Z[i]))
      .attr("x1", i => xScale(X1[i]))
      // if a book ended in a different year, have its line run to the end of the year
      .attr("x2", i => Y1[i].getTime() == Y2[i].getTime() ? xScale(X2[i]) : xScale(new Date('2015/12/31')))
      .attr("y1", i => yScale(Y1[i]) + Y_dodge[i])
      .attr("y2", i => yScale(Y1[i]) + Y_dodge[i])
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => tooltip.attr('display', 'none'))
    .clone()
      // draw lines that start at the beginning of the year
      .attr("x1", i => xScale(new Date('2015/01/01')))
      .attr("x2", i => xScale(X2[i]))
      // and make them only visible for those books that started in a different year
      .attr('stroke-opacity', i => Y1[i].getTime() == Y2[i].getTime() ? 0 : 1)
      .attr("y1", i => yScale(Y2[i]) + Y_dodge[i])
      .attr("y2", i => yScale(Y2[i]) + Y_dodge[i])
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => tooltip.attr('display', 'none'))



  const start_dots = g.selectAll("start_circle")
    .data(I)
    .join("circle")
      .attr("cx", i => xScale(X1[i]))
      .attr("cy", i => yScale(Y1[i]) + Y_dodge[i])
      .attr('fill', i => color(Z[i]))
      .attr("r", r)
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => tooltip.attr('display', 'none'))

  const end_dots = g.selectAll("end_circle")
    .data(I)
    .join("circle")
      .attr("cx", i => xScale(X2[i]))
      .attr("cy", i => yScale(Y2[i]) + Y_dodge[i])
      .attr('fill', i => color(Z[i]))
      .attr("r", r)
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => tooltip.attr('display', 'none'))

  var tooltip = svg.append('g')
                   .attr('class', 'tooltip')
                   .attr('display', 'none')
                   .attr('pointer-events', 'none')
                   .attr('font-family', 'sans-serif')
                   .attr('font-size', '10')
                   .attr('text-anchor', 'middle')

  tooltip.append('rect')
         .style('fill', 'white')
         .attr('y', '-60')
         .attr('height', '55')
         .style('stroke', 'black')
  tooltip.append('text')
         .attr('id', 'title')
         .attr('y', '-48')
         .attr('background-color', 'white')
  tooltip.append('text')
         .attr('id', 'author')
         .attr('y', '-36')
  tooltip.append('text')
         .attr('id', 'date_started')
         .attr('y', '-24')
  tooltip.append('text')
         .attr('id', 'date_read')
         .attr('y', '-12')

  return svg.node();
}
