if (!window.dash_clientside) {
    window.dash_clientside = {}
}


window.dash_clientside.clientside = {
    update_figure: function(metric_x, metric_y, runs, do_pareto, do_pareto_right, per_epoch, highlight_data, hidden_runs, layout_store) {
        if (runs == null) {
            return [{}, []]
        }
        if (per_epoch) {
            data = this.per_epoch_figure(metric_y, runs, highlight_data, hidden_runs['per epoch'])
        } else {
            data = this.point_figure(metric_x, metric_y, runs, do_pareto, do_pareto_right, highlight_data, hidden_runs['global'])
        }
        legendentries = data.map(item => (per_epoch) ? [item['customdata'][0]] : item['customdata'])
        layout = {'xaxis': {'title': {'text': metric_x}}, 'yaxis': {'title': {'text': metric_y}}}
        if ('xrange' in layout_store && layout_store['xrange'] != null) {
            layout['xaxis']['range'] = layout_store['xrange']
        }
        if ('yrange' in layout_store && layout_store['yrange'] != null) {
            layout['yaxis']['range'] = layout_store['yrange']
        }
        return [{'data': data, 'layout': layout}, legendentries]
    },

    per_epoch_figure: function(metric, runs, highlight_data, hidden_runs) {
        if (runs == null) {
            return {}
        }
        data = []
        for (var run in runs) {
            run = runs[run]
            epoch_data = JSON.parse(run['epoch_data'])
            xs = Object.keys(epoch_data).filter(item => metric in epoch_data[item]).sort((a, b) => a.localeCompare(b))
            if (xs.length == 0){
                continue
            }
            xs = xs.map(x => Number(x)).sort((a, b) => a-b)
            ys = xs.map(x => epoch_data[x][metric])
            run_name = run['model'].split('-')[0] + ' @' + run['image resolution (pretraining) [px]']
            if (run['image resolution (pretraining) [px]'] != run['image resolution (finetuning) [px]']) {
                run_name += '->' + run['image resolution (finetuning) [px]']
            }
            is_highlight = (run['model'] == highlight_data[0] && run['run name'] == highlight_data[1] && run['run date'] == highlight_data[2])
            linestyle = (is_highlight) ? {'dash': 'dot'} : {}
            is_hidden = (hidden_runs.some(hidden => hidden['model'] == run['model'] && hidden['run name'] == run['run name'] && hidden['run date'] == run['run date']))
            data.push({'x': xs, 'y': ys, 'name': run_name, 'line': linestyle,
                'customdata': Array(xs.length).fill([run['model'], run['run name'], run['run date']]),
                'type': 'scatter', 'hovertext': Array(xs.length).fill(run_name),
                'hovertemplate': '<b>%{hovertext}</b><br>model=' + run['model'] + '<br>epoch' + '=%{x}<br>' + metric + '=%{y}',
                'visible': (is_hidden) ? 'legendonly' : true
            })
        }

        return data
    },

    point_figure: function(metric_x, metric_y, runs, do_pareto, do_pareto_right, highlight_data, hidden_runs){
        if (runs == null) {
            return {}
        }
        if (do_pareto === undefined) {
            do_pareto = false
        }
        if (do_pareto_right === undefined) {
            do_pareto_right = false
        }
        filtered_runs = runs.filter(item => item[metric_x] >= 0 && item[metric_y] >= 0)
        grouped_runs = {}
        vals = []
        for (var run in filtered_runs) {
            run = filtered_runs[run]
            model = run['model']
            hovertext = model.split('-')[0] + ' @' + run['image resolution (pretraining) [px]']
            if (run['image resolution (pretraining) [px]'] != run['image resolution (finetuning) [px]']) {
                hovertext += '->' + run['image resolution (finetuning) [px]']
            }
            marker = 'circle'
            group = model
            if (highlight_data.length > 0 && model == highlight_data[0] && run['run name'] == highlight_data[1] && run['run date'] == highlight_data[2]) {
                group = model + '!'
                marker = 'x'
            }
            if ((!group in grouped_runs) || grouped_runs[group] == null) {
                is_hidden = (hidden_runs.some(hidden => hidden['model'] == model && hidden['run name'] == run['run name'] && hidden['run date'] == run['run date']))
                grouped_runs[group] = {'x': [run[metric_x]], 'y': [run[metric_y]], 'type': 'scatter', 'name': group,
                                       'mode': 'markers', 'hovertext': [hovertext], 'customdata': [[model, run['run name'], run['run date']]],
                                       'hovertemplate': '<b>%{hovertext}</b><br>model=' + model + '<br>' + metric_x + '=%{x}<br>' + metric_y + '=%{y}',
                                       'marker': {'symbol': marker}, 'visible': (is_hidden) ? 'legendonly' : true
                }

            } else {
                grouped_runs[group]['x'].push(run[metric_x])
                grouped_runs[group]['y'].push(run[metric_y])
                grouped_runs[group]['hovertext'].push(hovertext)
                grouped_runs[group]['customdata'].push([model, run['run name'], run['run date']])
            }
            vals.push([run[metric_x], run[metric_y]])
        }
        data = Object.keys(grouped_runs).map(key => grouped_runs[key])

        if (do_pareto) {
            ys = vals.map(item => item[1])
            y_min = Math.min(...ys)
            y_max = Math.max(...ys)
            xs = vals.map(item => item[0])
            x_min = Math.min(...xs)
            x_max = Math.max(...xs)

            pareto_points = []
            while (vals.length > 0) {
                ys = vals.map(item => item[1])
                max_idx = ys.indexOf(Math.max(...ys))
                pareto_item = vals[max_idx]
                pareto_points.push(pareto_item)
                if (do_pareto_right) {
                    vals = vals.filter(item => item[0] > pareto_item[0])
                } else {
                    vals = vals.filter(item => item[0] < pareto_item[0])
                }
            }
            pareto_min = Math.max(0, y_min - 0.05 * (y_max - y_min))
            pareto_left = x_min - 0.05 * (x_max - x_min)
            pareto_right = x_max + 0.05 * (x_max - x_min)
            pareto_points = pareto_points.sort((a, b) => a[0] - b[0])
            if (do_pareto_right) {
                pareto_points.unshift([pareto_left, y_max])
                pareto_points.push([x_max, pareto_min])
            } else {
                pareto_points.unshift([x_min, pareto_min])
                pareto_points.push([pareto_right, y_max])
            }
            pp_last = pareto_points[0]
            pareto_bound = [pp_last]
            for (pp in pareto_points) {
                pp = pareto_points[pp]
                if (pp[1] < pp_last[1]) {
                    pareto_bound.push([pp_last[0], pp[1]])
                } else {
                    pareto_bound.push([pp[0], pp_last[1]])
                }
                pareto_bound.push(pp)
                pp_last = pp
            }
            pareto_xs = pareto_bound.map(item => item[0])
            pareto_ys = pareto_bound.map(item => item[1])
            data.push({'x': pareto_xs, 'y': pareto_ys, 'type': 'scatter', 'mode': 'lines', 'name': 'Pareto boundary'})
        }

        return data
    },

    set_highlight: function(graph_click, table_cell, table_data) {
        default_styling = this.default_conditional_styling()
        if (graph_click == null && table_cell == null) {
            return [[], default_styling]
        }
        highlight_run_data = []
        trigger = window.dash_clientside.callback_context.triggered[0]['prop_id']
        if (trigger.includes('graph')) {
            highlight_run_data = graph_click.points[0]['customdata']
        } else {
            highlight_run_data = [table_data[table_cell.row].model, table_data[table_cell.row]['run name'], table_data[table_cell.row]['run date']]
        }
        default_styling.push({'if': {'filter_query': '{run name} = "' + highlight_run_data[1] + '" && {run date} = ' + highlight_run_data[2]}, 'backgroundColor': '#D3D3D3'})
        default_styling.push({'if': {'state': 'selected', 'filter_query': '{run name} = "' + highlight_run_data[1] + '" && {run date} = ' + highlight_run_data[2]}, 'backgroundColor': '#D3D3D3', 'border': 'inherit !important'})
        return [highlight_run_data, default_styling]
    },

    default_conditional_styling: function () {
        return [
            {'if': {'column_id': 'image resolution (pretraining) [px]', 'filter_query': '{image resolution (pretraining) [px]} != 224'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'image resolution (finetuning) [px]', 'filter_query': '{image resolution (finetuning) [px]} != 224'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'GPUS (pretraining)', 'filter_query': '{GPUS (pretraining)} != 4'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'GPUS (finetuning)', 'filter_query': '{GPUS (finetuning)} != 4'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'dataloader workers (pretraining)', 'filter_query': '{dataloader workers (pretraining)} != 44'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'dataloader workers (finetuning)', 'filter_query': '{dataloader workers (finetuning)} != 44'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'lr (pretraining)', 'filter_query': '{lr (pretraining)} != 3e-3'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'lr (finetuning)', 'filter_query': '{lr (finetuning)} = 3e-4'}, 'fontWeight': 'bold', 'color': 'green'},
            {'if': {'column_id': 'lr (finetuning)', 'filter_query': '{lr (finetuning)} != 3e-4'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'column_id': 'optimizer eps', 'filter_query': '{optimizer eps} != 1e-7'}, 'fontWeight': 'bold', 'color': 'tomato'},
            {'if': {'state': 'selected'}, 'backgroundColor': 'white', 'border': 'inherit !important'},
        ]
    },

    picker_options: function (per_epoch) {
        point_metrics = ['image resolution (pretraining) [px]', 'GPUS (pretraining)', 'lr (pretraining)',
                 'image resolution (finetuning) [px]', 'GPUs (finetuning)', 'lr (finetuning)',
                 'inference VRAM @32 [GB]', 'inference VRAM @128 [GB]', 'inference VRAM @1 [GB]', 'inference VRAM @64 [GB]',
                 'total finetuning time [h*GPUs]', 'total validation time [h*GPUs]', 'throughput [ims/s]', 'throughput batch size [ims]',
                 'training VRAM [GB]', 'training VRAM (single GPU) [GB]', 'number of parameters [Millions]', 'GFLOPs',
                 'validation loss', 'training loss', 'top-5 validation accuracy', 'top-5 training accuracy',
                 'top-1 validation accuracy', 'top-1 training accuracy']

        per_epoch_metrics = ['gradient norm (max)', 'learning rate', 'training time per epoch [h*GPUs]', 'validation loss',
            'training loss', 'top-5 validation accuracy', 'gradient norm (infinities)',
            'gradient norm (80-th percentile)', 'validation time per epoch [h*GPUs]', 'gradient norm (mean)',
            'training time (total) [h*GPUs]', 'validation time (total) [h*GPUs]', 'gradient norm (20-th percentile)',
            'top-5 training accuracy', 'top-1 training accuracy', 'top-1 validation accuracy',
        ]

        if (per_epoch) {
            per_epoch_metrics = per_epoch_metrics.sort((a, b) => a.localeCompare(b))
            return [['epoch'], 'epoch', per_epoch_metrics, 'top-1 validation accuracy']
        }
        point_metrics = point_metrics.sort((a, b) => a.localeCompare(b))
        return [point_metrics, 'throughput [ims/s]', point_metrics, 'top-1 validation accuracy']
    },

    buttons_enabled: function(pareto_on, per_epoch) {
        // return [per_epoch || !pareto_on, per_epoch]
        return per_epoch
    },

    hidden_items_store: function(restyle_data, hidden_store_state, legend_entries, per_epoch) {
        if (restyle_data == null) {
            return {'per epoch': [], 'global': []}
        }
        if (per_epoch == null) {
            per_epoch = false
        }
        hidden_state_first_level_key = (per_epoch) ? 'per epoch' : 'global'
        for (var run_i in restyle_data[1]) {
            hide_runs = (restyle_data[0].visible[run_i] == 'legendonly')
            for (var run_data in legend_entries[restyle_data[1][run_i]]) {
                run_data = legend_entries[restyle_data[1][run_i]][run_data]
                run_data = {'model': run_data[0], 'run name': run_data[1], 'run date': run_data[2]}
                if (hide_runs) {
                    hidden_store_state[hidden_state_first_level_key].push(run_data)
                } else {
                    hidden_store_state[hidden_state_first_level_key] = hidden_store_state[hidden_state_first_level_key]
                        .filter(hidden_data => Object.keys(run_data)
                            .some(key => run_data[key] != hidden_data[key]))
                }
            }
        }
        return hidden_store_state
    },

    plot_layout_store: function(graph_relayout_data, metric_x, metric_y, layout_store_state) {
        triggers = window.dash_clientside.callback_context.triggered.map(item => item.prop_id)
        if (triggers.some(trigger => trigger.includes('x-picker')) && 'xrange' in layout_store_state) {
            delete layout_store_state['xrange']
        }
        if (triggers.some(trigger => trigger.includes('y-picker')) && 'yrange' in layout_store_state) {
            delete layout_store_state['yrange']
        }

        if (graph_relayout_data == null) {
            return layout_store_state
        }

        if (triggers.some(trigger => trigger.includes('graph'))) {
            if ('autosize' in graph_relayout_data && graph_relayout_data['autosize']) {
                return {}
            }

            if ('xaxis.range[0]' in graph_relayout_data && graph_relayout_data['xaxis.range[0]'] != null) {
                layout_store_state['xrange'] = [graph_relayout_data['xaxis.range[0]'], graph_relayout_data['xaxis.range[1]']]
            }

            if ('yaxis.range[0]' in graph_relayout_data && graph_relayout_data['yaxis.range[0]'] != null) {
                layout_store_state['yrange'] = [graph_relayout_data['yaxis.range[0]'], graph_relayout_data['yaxis.range[1]']]
            }

            if ('xaxis.autorange' in graph_relayout_data && graph_relayout_data['xaxis.autorange'] && 'xrange' in layout_store_state) {
                delete layout_store_state['xrange']
            }
            if ('yaxis.autorange' in graph_relayout_data && graph_relayout_data['yaxis.autorange'] && 'yrange' in layout_store_state) {
                delete layout_store_state['yrange']
            }
        }

        return layout_store_state
    },

    cookie_modal: function(clicks) {
        return clicks == null || clicks <= 0;
    },

    pareto_right: function(metric_x) {
        return metric_x.toLowerCase().includes('throughput')
    }
}




