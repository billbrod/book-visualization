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

function get_z(z_name) {
  try {
    z_name = d3.select("#" + z_name + "_z_select").property('value')
  } catch (e) {
    if (!(e instanceof TypeError)) {
      console.error(e)
    }
    // else we assume it's because z_name isn't related to the element typebut
    // already the name of the z
  }
  if (z_name === 'ownership') {
    function z(d) {
      if (['Henry', 'Maija', 'Joseph', 'Natalie'].indexOf(d.ownership) != -1) return 'friend'
      return d.ownership
    }
  } else {
    z = d => d[z_name]
  }
  return z
}

function get_colormap(data, plot_type) {
  z_name = d3.select("#" + plot_type + "_z_select").property('value')
  z = get_z(z_name)
  var Z = d3.map(data, z)
  // turn it into a set to remove duplicates, then back into an array so we can
  // use filter and sort
  zDomain = new Array(...new d3.InternSet(Z));
  var order;
  var color;
  if (z_name === 'fiction') {
    var colors = d3.schemeCategory10
    order = ['True', 'False']
  } else if (z_name === 'ownership') {
    var colors = d3.schemeDark2
    // this makes sure the order is me, library, Anna, friend, and then anything
    // else, in alphabetical order
    order = ['me', 'library', 'Anna', 'friend']
    zDomain = zDomain.filter(v => order.indexOf(v) == -1)
    order = order.concat(zDomain.sort())
  } else if (z_name === 'format') {
    var colors = d3.schemePaired.slice(0, 2).concat([d3.schemePaired[3], d3.schemePaired[8]])
    order = ['paperback', 'hardback', 'ebook', 'print-on-demand']
  } else if (z_name === 'rating') {
    var colors = d3.schemeOrRd[5]
    order = ["1", "2", "3", "4", "5"]
  }
  if (color === undefined) color = d3.scaleOrdinal(order, colors);
  return [color, order]
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
  r = 3, // (fixed) radius of dots, in pixels
  marginTop = 20, // top margin, in pixels
  marginRight = 30, // right margin, in pixels
  marginBottom = 25, // bottom margin, in pixels
  marginLeft = 40, // left margin, in pixels
  width = 640, // outer width, in pixels
  height_per_year = 140,
  xType = d3.scaleLinear, // type of x-scale
  xRange = [marginLeft + marginLeft, width - marginRight - marginRight], // [left, right]
  yType = d3.scaleLinear, // type of y-scale
  xFormat, // a format specifier string for the x-axis
  yFormat, // a format specifier string for the y-axis
  padding = 1.5, // (fixed) padding between the circles
} = {}) {
  z = get_z('scatter')
  // Compute values.
  const X1 = d3.map(data, x1);
  const X2 = d3.map(data, x2);
  const Y1 = d3.map(data, y1);
  const Y2 = d3.map(data, y2);
  var Z = d3.map(data, z);
  const authors = d3.map(data, d => d.author);
  const I = d3.range(X1.length).filter(i => !isNaN(X1[i]) && !isNaN(Y1[i]));
  // Compute default domains.
  var xDomain = d3.extent(X1);
  var yDomain = d3.extent(Y1);

  // compute height based on number of years
  var unique_times = [...new Set(Y1.map(d => d.getTime()))]
  height = new Set([...unique_times, ...new Set(Y2.map(d => d.getTime()))])
  height = marginBottom + height_per_year * height.size + marginTop
  var yRange = [height - marginBottom - height_per_year, marginTop]

  // Construct scales and axes.
  const xScale = xType(xDomain, xRange);
  // need to pad an extra year for the ticks
  const yScale = yType(yDomain, yRange).nice(d3.min(Y1).getFullYear(), d3.timeYear.count(d3.max(Y1).getFullYear()));
  const xAxis = d3.axisBottom(xScale).ticks(d3.timeMonth.every(1), xFormat);
  const yAxis = d3.axisLeft(yScale).ticks(d3.timeYear.every(1), yFormat);
  [color, order] = get_colormap(data, 'scatter')

  swatchSize = 15
  var legend = Swatches(color, {marginLeft: marginLeft, swatchSize: swatchSize, marginTop: 0})

  d3.select('#legend-swatches').html(legend)

  d3.select('#bar_y_select')
    .style('margin-left', (width - document.getElementById('legend-swatches').offsetWidth + 5).toString() + 'px')

  const svg = d3.select("#scatter")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  function update_tooltip(d, x, y) {
    tooltip.attr('display', null)
    tt_padding = 10
    elements = []
    elements.push(d3.select('#title').text(d.title))
    elements.push(d3.select('#author').text("by " + d.author))
    elements.push(d3.select('#date_started').text("Started: " + format_date(d, true)));
    elements.push(d3.select('#date_read').text("Finished: " + format_date(d, false)));
    d3.select('#tooltip-rect-scatter').attr('width', d3.max(elements.map(elt => elt.node().getBBox().width))+tt_padding)
    d3.select('#tooltip-rect-scatter').attr('x', d3.min(elements.map(elt => elt.node().getBBox().x))-tt_padding/2)
    if (x - d3.select('#tooltip-rect-scatter').attr('width')/2 < 0) {
      d3.select('.tooltip-scatter').attr('text-anchor', 'start')
    } else if (x + d3.select('#tooltip-rect-scatter').attr('width')/2 > svg.attr('width')) {
      d3.select('.tooltip-scatter').attr('text-anchor', 'end')
    } else {
      d3.select('.tooltip-scatter').attr('text-anchor', 'middle')
    }
    // need to check this again after potentially updating the text-anchor
    d3.select('#tooltip-rect-scatter').attr('x', d3.min(elements.map(elt => elt.node().getBBox().x))-tt_padding/2)
    if (y - d3.select('#tooltip-rect-scatter').attr('height') < 0) {
      y = y + Number(d3.select('#tooltip-rect-scatter').attr('height')) + r*2+padding
    }
    tooltip.attr('transform', `translate(${x},${y})`)
    d3.selectAll('circle')
      .attr('fill-opacity', i => authors[i] == d.author ? 1 : .1)
    d3.selectAll('.connect')
      .attr('stroke-opacity', i => authors[i] == d.author ? 1 : .1)
    d3.selectAll('.year-start')
      .attr('stroke-opacity', i => authors[i] == d.author ? 1 : .1)
  };

  function hide_tooltip() {
    tooltip.attr('display', 'none')
    d3.selectAll('circle')
      .attr('fill-opacity', 1)
    d3.selectAll('.connect')
      .attr('stroke-opacity', 1)
    d3.selectAll('.year-start')
      .attr('stroke-opacity', 1)
  }

  svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(xAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
          .attr("y2", marginTop + marginBottom - height)
          .attr("stroke-opacity", 0.1))

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

  const g = svg.append("g")

  // Compute the y offsets.
  var Y_dodge = new Array(Y1.length).fill(0);
  var last_years_offset = []
  // do this separately for each year
  for (var idx = 0; idx < unique_times.length; idx++) {
    // get all books that have either their start or end in this year
    var Y1_mask = Y1.map(d => d.getTime() == unique_times[idx])
    var Y2_mask = Y2.map(d => d.getTime() == unique_times[idx])
    var masked_I = I.filter((v, i) => Y1_mask[i] || Y2_mask[i])
    // get the relevant x position
    var masked_X1 = masked_I.map(i => xScale(X1[i]))
    var masked_Y1 = masked_I.map(i => Y1[i].getTime())
    // if the end of the book isn't this year, use the end of the year
    var masked_X2 = masked_I.map(i => Y1[i].getTime() == Y2[i].getTime() ? xScale(X2[i]) : xScale(new Date('2015/12/31')))
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
    // multiply the offset by the apprioriate value
    tmp = tmp.map(y => (r*2+padding)*y);
    for (tmp_idx of d3.range(tmp.length)) {
      // grab only those values from tmp whose start date are in this year
      if (!I1_check.includes(tmp_idx)) {
        continue
      }
      Y_dodge[masked_I[tmp_idx]] = tmp[tmp_idx]
    }
  }

  g.selectAll("line")
    .data(I)
    .join('line')
      .attr('class', 'year-start')
      // draw lines that start at the beginning of the year
      .attr("x1", i => xScale(new Date('2015/01/01')))
      .attr("x2", i => xScale(X2[i]))
      // and make them only visible for those books that started in a different year
      .attr('display', i => Y1[i].getTime() == Y2[i].getTime() ? 'none' : null)
      .attr("y1", i => yScale(Y2[i]) + Y_dodge[i])
      .attr("y2", i => yScale(Y2[i]) + Y_dodge[i])
      .attr("stroke", i => color(Z[i]))
      .attr('id', i => authors[i])
      .attr('stroke-width', r*2)
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => hide_tooltip())
    .clone()
      .attr("class", 'connect')
      .attr('display', null)
      .attr("x1", i => xScale(X1[i]))
      // if a book ended in a different year, have its line run to the end of the year
      .attr("x2", i => Y1[i].getTime() == Y2[i].getTime() ? xScale(X2[i]) : xScale(new Date('2015/12/31')))
      .attr("y1", i => yScale(Y1[i]) + Y_dodge[i])
      .attr("y2", i => yScale(Y1[i]) + Y_dodge[i])
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => hide_tooltip())

  g.selectAll("circle")
    .data(I)
    .join("circle")
      .attr("cx", i => xScale(X1[i]))
      .attr("cy", i => yScale(Y1[i]) + Y_dodge[i])
      .attr('fill', i => color(Z[i]))
      .attr("r", r)
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => hide_tooltip())
    .clone()
      .attr("cx", i => xScale(X2[i]))
      .attr("cy", i => yScale(Y2[i]) + Y_dodge[i])
      .on("mouseover", (event, i) => update_tooltip(data[i], xScale(X1[i]), yScale(Y1[i]) + Y_dodge[i]))
      .on("mouseout", () => hide_tooltip())

  var tooltip = svg.append('g')
                   .attr('class', 'tooltip-scatter')
                   .attr('display', 'none')
                   .attr('pointer-events', 'none')
                   .attr('font-family', 'sans-serif')
                   .attr('font-size', '10')
                   .attr('text-anchor', 'middle')

  tooltip.append('rect')
         .attr('id', 'tooltip-rect-scatter')
         .style('fill', 'white')
         .attr('y', '-60')
         .attr('height', '55')
         .style('stroke', 'black')
  tooltip.append('text')
         .attr('id', 'title')
         .attr('y', '-48')
  tooltip.append('text')
         .attr('id', 'author')
         .attr('y', '-36')
  tooltip.append('text')
         .attr('id', 'date_started')
         .attr('y', '-24')
  tooltip.append('text')
         .attr('id', 'date_read')
         .attr('y', '-12')

  // add x labels to barplot, then can switch colors separately (add toggle to make second dropdown not locked
  function update_z() {
    z = get_z('scatter')
    Z = d3.map(data, z);
    [color, order] = get_colormap(data, 'scatter');
    d3.selectAll('.connect')
      .attr('stroke', i => color(Z[i]))
    d3.selectAll('.year-start')
      .attr('stroke', i => color(Z[i]))
    d3.selectAll('circle')
      .attr('fill', i => color(Z[i]))
    legend = Swatches(color, {marginLeft: marginLeft, swatchSize: swatchSize, marginTop: 0})
    d3.select('#legend-swatches')
      .html(legend)
    d3.select('#lock_check').on('click')();
    d3.select('#bar_y_select')
      .style('margin-left', (width - document.getElementById('legend-swatches').offsetWidth + 5).toString() + 'px')
  }
  d3.select('#scatter_z_select')
    .on('change', () => update_z())


  return svg.node();
}
// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend
function Swatches(color, {
  columns = null,
  format,
  unknown: formatUnknown,
  swatchSize = 15,
  swatchWidth = swatchSize,
  swatchHeight = swatchSize,
  marginLeft = 0
} = {}) {
  const id = `-swatches-${Math.random().toString(16).slice(2)}`;
  const unknown = formatUnknown == null ? undefined : color.unknown();
  const unknowns = unknown == null || unknown === d3.scaleImplicit ? [] : [unknown];
  const domain = color.domain().concat(unknowns);
  if (format === undefined) format = x => x === unknown ? formatUnknown : x;

  function entity(character) {
    return `&#${character.charCodeAt(0).toString()};`;
  }

  if (columns !== null) return `<div style="display: flex; align-items: center; margin-left: ${+marginLeft}px; min-height: 33px; font: 10px sans-serif;">
  <style>

.${id}-item {
  break-inside: avoid;
  display: flex;
  align-items: center;
  padding-bottom: 1px;
}

.${id}-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - ${+swatchWidth}px - 0.5em);
}

.${id}-swatch {
  width: ${+swatchWidth}px;
  height: ${+swatchHeight}px;
  margin: 0 0.5em 0 0;
}

  </style>
  <div style=${{width: "100%", columns}}>${domain.map(value => {
    const label = `${format(value)}`;
    return `<div class=${id}-item>
      <div class=${id}-swatch style=${{background: color(value)}}></div>
      <div class=${id}-label title=${label}>${label}</div>
    </div>`;
  })}
  </div>
</div>`;

  return `<div style="display: flex; align-items: center; min-height: 33px; margin-left: ${+marginLeft}px; font: 10px sans-serif;">
   <style>

 .${id} {
   display: inline-flex;
   align-items: center;
   margin-right: 1em;
 }

 .${id}::before {
   content: "";
   width: ${+swatchWidth}px;
   height: ${+swatchHeight}px;
   margin-right: 0.5em;
   background: var(--color);
 }

   </style>
  <div>${domain.map(value => `<span class="${id}" style="--color: ${color(value)}">${format(value)}</span>`).join('')}</div>`;
}
