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
    function translate_vector(idx, shift_bboxes, check_bboxes) {
        bbox = shift_bboxes[idx]
        ctr_vecs = check_bboxes.map(bb => [bbox.midx-bb.midx, bbox.midy-bb.midy])
        ctr_vecs = ctr_vecs.filter((bb, i) => overlap(check_bboxes[i], bbox))
        ctr_vecs_2 = shift_bboxes.map(bb => [bbox.midx-bb.midx, bbox.midy-bb.midy])
        ctr_vecs_2 = ctr_vecs_2.filter((bb, i) => i!=idx && overlap(shift_bboxes[i], bbox))
        ctr_vecs = ctr_vecs.concat(ctr_vecs_2).concat([0, 0])
        ctr_vecs = [d3.sum(ctr_vecs.map(bb => bb[0])), d3.sum(ctr_vecs.map(bb => bb[1]))]
        mag = Math.sqrt(ctr_vecs[0]**2 + ctr_vecs[1]**2)
        return ctr_vecs.map(c => c/mag)
    }

    // adapted from https://github.com/mwkling/rectangle-overlap/blob/master/strategies/separation.py
    function separate_rects(shift_bboxes, tvals, check_bboxes, check_tvals) {
        // first turn bboxes into rectangles
        shift_bboxes = shift_bboxes.map((bb, i) => ({'x1': bb.x+tvals[i][0], 'y1': bb.y+tvals[i][1],
                                                     'x2': bb.x+bb.width+tvals[i][0], 'y2': bb.y+bb.height+tvals[i][1],
                                                     'midx': bb.x+tvals[i][0]+bb.width/2, 'midy': bb.y+tvals[i][1]+bb.height/2}))
        check_bboxes = check_bboxes.map((bb, i) => ({'x1': bb.x+check_tvals[i][0], 'y1': bb.y+check_tvals[i][1],
                                                     'x2': bb.x+bb.width+check_tvals[i][0], 'y2': bb.y+bb.height+check_tvals[i][1],
                                                     'midx': bb.x+check_tvals[i][0]+bb.width/2, 'midy': bb.y+check_tvals[i][1]+bb.height/2}))
        return shift_bboxes.map((bb, i) => translate_vector(i, shift_bboxes, check_bboxes))
    }

    function shift_rects(visible_check, shift_translate, shift_bboxes, check_translate, check_bboxes) {
        unique_checks = Array(...new Set(visible_check))
        if (check_translate === undefined) {
            check_translate = []
            check_bboxes = []
        } else {
            check_bboxes = check_bboxes.map((r, i) => check_bboxes.map((t, j) => visible_check[i] == visible_check[j] ? [j, t] : null).filter(r => r != null))
            check_bboxes = unique_checks.map(i => check_bboxes[visible_check.indexOf(i)])
            check_bboxes = check_bboxes.filter(r => r.length > 1)
        }
        var offsets, translate_values
        loop_n = 0
        indices_flat = [0]
        // get an array of arrays, each of which contains all bboxes which will be visible at same time
        bboxes = shift_bboxes.map((r, i) => shift_bboxes.map((t, j) => visible_check[i] == visible_check[j] ? [j, t] : null).filter(r => r != null))
        // for each set of arrays that will be visible at same time, grab the first one
        bboxes = unique_checks.map(i => bboxes[visible_check.indexOf(i)])
        // only grab those arrays of bboxes that contain more than one book
        bboxes = bboxes.filter(r => r.length > 1)
        while (indices_flat.length > 0) {
            // separate out the bboxes and indices
            bbox_indices = bboxes.map(r => r.map(r_ => r_[0]))
            bbox_values = bboxes.map(r => r.map(r_ => r_[1]))
            check_bbox_indices = check_bboxes.map(r => r.map(r_ => r_[0]))
            check_bbox_values = check_bboxes.map(r => r.map(r_ => r_[1]))
            check_translate_values = check_bbox_indices.map(idx => idx.map(i => check_translate[i]))
            // grab translate values that correspond to the bboxes we're interested in
            translate_values = bbox_indices.map(idx => idx.map(i => shift_translate[i]))
            offsets = bbox_values.map((r, i) => separate_rects(r, translate_values[i], check_bbox_values[i] === undefined ? [] : check_bbox_values[i],
                                                               check_translate_values[i] === undefined ? []: check_translate_values[i]))
            // grab only those translate values that are non-nans
            bbox_indices = bbox_indices.map((o, i) => o.filter((o_, j) => !(Number.isNaN(offsets[i][j][0]))))
            offsets = offsets.map(o => o.filter(o_ => !(Number.isNaN(o_[0]))))
            bbox_indices = bbox_indices.filter(o => o.length > 0)
            offsets = offsets.filter(o => o.length > 0)
            // for any non nan offsets, adjust shift_translate by that amount
            indices_flat = bbox_indices.flat()
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
            shift_translate = shift_translate.map((t, i) => update_translate(t, i))
            loop_n ++
            if (loop_n > 1000) {
                break
            }
        }
        return shift_translate
    }

    // get the translate value and then send it back
    postMessage(shift_rects(e.data[0], e.data[1], e.data[2], e.data[3], e.data[4]))
}
