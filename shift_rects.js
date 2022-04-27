importScripts("https://d3js.org/d3.v7.min.js")
onmessage = function(e) {
    // from https://gist.github.com/Daniel-Hug/d7984d82b58d6d2679a087d896ca3d2b
    function overlap(a, b) {
        // no horizontal overlap
        if (a.x1 >= b.x2 || b.x1 >= a.x2) return false;
        // no vertical overlap
        if (a.y1 >= b.y2 || b.y1 >= a.y2) return false;
        return true;
    }

    // adapted from https://github.com/mwkling/rectangle-overlap/blob/master/strategies/separation.py
    function translate_vector(idx, bboxes) {
        bbox = bboxes[idx]
        ctr_vecs = bboxes.map(bb => [bbox.midx-bb.midx, bbox.midy-bb.midy])
        ctr_vecs = ctr_vecs.filter((bb, i) => i!=idx && overlap(bboxes[i], bbox))
        ctr_vecs = ctr_vecs.concat([0, 0])
        ctr_vecs = [d3.sum(ctr_vecs.map(bb => bb[0])), d3.sum(ctr_vecs.map(bb => bb[1]))]
        mag = Math.sqrt(ctr_vecs[0]**2 + ctr_vecs[1]**2)
        return ctr_vecs.map(c => c/mag)
    }

    // adapted from https://github.com/mwkling/rectangle-overlap/blob/master/strategies/separation.py
    function separate_rects(bboxes, tvals) {
        // first turn bboxes into rectangles
        bboxes = bboxes.map((bb, i) => ({'x1': bb.x+tvals[i][0], 'y1': bb.y+tvals[i][1],
                                         'x2': bb.x+bb.width+tvals[i][0], 'y2': bb.y+bb.height+tvals[i][1],
                                         'midx': bb.x+tvals[i][0]+bb.width/2, 'midy': bb.y+tvals[i][1]+bb.height/2}))
        return bboxes.map((bb, i) => translate_vector(i, bboxes))
    }

    function shift_rects(visible_check, translate, mini_bboxes) {
        unique_checks = Array(...new Set(visible_check))
        var offsets, translate_values
        idx = 0
        indices_flat = [0]
        // get an array of arrays, each of which contains all mini tooltips which will be visible at same time
        mini_bboxes = mini_bboxes.map((r, i) => mini_bboxes.map((t, j) => visible_check[i] == visible_check[j] ? [j, t] : null).filter(r => r != null))
        // for each set of arrays that will be visible at same time, grab the first one
        mini_bboxes = unique_checks.map(i => mini_bboxes[unique_checks.indexOf(i)])
        // only grab those arrays of bboxes that contain more than one book
        mini_bboxes = mini_bboxes.filter(x => x.length > 1)
        while (indices_flat.length > 0) {
            // separate out the bboxes and indices
            mini_bbox_indices = mini_bboxes.map(r => r.map(r_ => r_[0]))
            mini_bbox_values = mini_bboxes.map(r => r.map(r_ => r_[1]))
            // grab translate values that correspond to the bboxes we're interested in
            translate_values = mini_bbox_indices.map(idx => idx.map(i => translate[i]))
            offsets = mini_bbox_values.map((r, i) => separate_rects(r, translate_values[i]))
            // grab only those translate values that are non-nans
            mini_bbox_indices = mini_bbox_indices.map((o, i) => o.filter((o_, j) => !(Number.isNaN(offsets[i][j][0]))))
            offsets = offsets.map(o => o.filter(o_ => !(Number.isNaN(o_[0]))))
            mini_bbox_indices = mini_bbox_indices.filter(o => o.length > 0)
            offsets = offsets.filter(o => o.length > 0)
            // for any non nan offsets, adjust translate by that amount
            indices_flat = mini_bbox_indices.flat()
            offsets_flat = offsets.flat()

            function update_translate(t, i) {
                if (indices_flat.indexOf(i) > -1) {
                    j = indices_flat.indexOf(i)
                    t[0] += offsets_flat[j][0]
                    t[1] += offsets_flat[j][1]
                }
                return [t[0], t[1]]
            }
            // update translate
            translate = translate.map((t, i) => update_translate(t, i))
        }
        return translate
    }

    // get the translate value and then send it back
    postMessage(shift_rects(e.data[0], e.data[1], e.data[2]))
}
