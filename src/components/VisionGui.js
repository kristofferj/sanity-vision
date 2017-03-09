import React, {PropTypes} from 'react'
import queryString from 'query-string'
import {storeState, getState} from '../util/localState'
import parseApiQueryString from '../util/parseApiQueryString'
import tryParseParams from '../util/tryParseParams'
import DelayedSpinner from './DelayedSpinner'
import QueryEditor from './QueryEditor'
import ParamsEditor from './ParamsEditor'
import ResultView from './ResultView'
import NoResultsDialog from './NoResultsDialog'
import QueryErrorDialog from './QueryErrorDialog'

const sanityUrl = /\.api\.sanity\.io.*?(?:query|listen)\/(.*?)\?(.*)/

class VisionGui extends React.PureComponent {
  constructor(props) {
    super(props)

    const lastQuery = getState('lastQuery')
    const lastParams = getState('lastParams')

    this.subscribers = {}
    this.state = {
      query: lastQuery,
      params: lastParams && tryParseParams(lastParams),
      rawParams: lastParams,
      queryInProgress: false,
      editorHeight: 100
    }

    this.handleChangeDataset = this.handleChangeDataset.bind(this)
    this.handleListenExecution = this.handleListenExecution.bind(this)
    this.handleListenerMutation = this.handleListenerMutation.bind(this)
    this.handleQueryExecution = this.handleQueryExecution.bind(this)
    this.handleQueryChange = this.handleQueryChange.bind(this)
    this.handleParamsChange = this.handleParamsChange.bind(this)
    this.handleHeightChange = this.handleHeightChange.bind(this)
    this.handlePaste = this.handlePaste.bind(this)
  }

  componentDidMount() {
    const firstDataset = this.props.datasets[0] && this.props.datasets[0].name
    const dataset = getState('dataset', firstDataset)
    this.context.client.config({dataset})

    window.document.addEventListener('paste', this.handlePaste)
  }

  componentWillUnmount() {
    this.cancelQuery()
    this.cancelListener()
  }

  handlePaste(evt) {
    const data = evt.clipboardData.getData('text/plain')
    const match = data.match(sanityUrl)
    if (!match) {
      return
    }

    const [, dataset, urlQuery] = match
    const qs = queryString.parse(urlQuery)
    let parts

    try {
      parts = parseApiQueryString(qs)
    } catch (err) {
      console.warn('Error while trying to parse API URL: ', err.message) // eslint-disable-line no-console
      return // Give up on error
    }

    if (this.context.client.config().dataset !== dataset) {
      this.handleChangeDataset({target: {value: dataset}})
    }

    evt.preventDefault()
    this.setState({
      query: parts.query,
      params: parts.params,
      rawParams: JSON.stringify(parts.params, null, 2)
    })
  }

  cancelQuery() {
    if (!this.subscribers.query) {
      return
    }

    this.subscribers.query.unsubscribe()
    this.subscribers.query = null
  }

  cancelListener() {
    if (!this.subscribers.listen) {
      return
    }

    this.subscribers.listen.unsubscribe()
    this.subscribers.listen = null
  }

  handleChangeDataset(evt) {
    const dataset = evt.target.value
    storeState('dataset', dataset)
    this.setState({dataset})
    this.context.client.config({dataset})
    this.handleQueryExecution()
  }

  handleListenerMutation(mut) {
    const listenMutations = [mut].concat(this.state.listenMutations)
    if (listenMutations.length > 50) {
      listenMutations.pop()
    }

    this.setState({listenMutations})
  }

  handleListenExecution() {
    const {query, params, rawParams, listenInProgress} = this.state
    if (listenInProgress) {
      this.cancelListener()
      this.setState({listenInProgress: false})
      return
    }

    const client = this.context.client
    const paramsError = params instanceof Error && params
    storeState('lastQuery', query)
    storeState('lastParams', rawParams)

    this.cancelQuery()

    this.setState({
      listenMutations: [],
      queryInProgress: false,
      listenInProgress: !paramsError && Boolean(query),
      error: paramsError || undefined,
      result: undefined,
      queryTime: null,
      e2eTime: null
    })

    if (!query || paramsError) {
      return
    }

    this.subscribers.listen = client.listen(query, params, {}).subscribe({
      next: this.handleListenerMutation,
      error: error => this.setState({
        error,
        query,
        listenInProgress: false
      })
    })
  }

  handleQueryExecution() {
    const {query, params, rawParams} = this.state
    const client = this.context.client.observable
    const paramsError = params instanceof Error && params
    storeState('lastQuery', query)
    storeState('lastParams', rawParams)

    this.cancelListener()

    this.setState({
      queryInProgress: !paramsError && Boolean(query),
      listenInProgress: false,
      listenMutations: [],
      error: paramsError || undefined,
      result: undefined,
      queryTime: null,
      e2eTime: null
    })

    if (!query || paramsError) {
      return
    }

    const queryStart = Date.now()
    this.subscribers.query = client.fetch(query, params, {filterResponse: false}).subscribe({
      next: res => this.setState({
        query,
        queryTime: res.ms,
        e2eTime: Date.now() - queryStart,
        result: res.result,
        queryInProgress: false,
        error: null
      }),
      error: error => this.setState({
        error,
        query,
        queryInProgress: false
      })
    })
  }

  handleQueryChange(data) {
    this.setState({query: data.query})
  }

  handleParamsChange(data) {
    this.setState({rawParams: data.raw, params: data.parsed})
  }

  handleHeightChange(newHeight) {
    if (this.state.editorHeight !== newHeight) {
      this.setState({editorHeight: Math.max(newHeight, 75)})
    }
  }

  render() {
    const {client, components} = this.context
    const {error, result, query, queryInProgress, listenInProgress, queryTime, e2eTime, listenMutations} = this.state
    const {Button, Select} = components
    const styles = this.context.styles.visionGui
    const dataset = client.config().dataset
    const datasets = this.props.datasets.map(set => set.name)
    const hasResult = !error && !queryInProgress && typeof result !== 'undefined'

    // Note that because of react-json-inspector, we need at least one
    // addressable, non-generated class name. Therefore;
    // leave `sanity-vision` untouched!
    const visionClass = ['sanity-vision', this.context.styles.visionGui.root].filter(Boolean).join(' ')
    return (
      <div className={visionClass}>
        <form action="#" className="pure-form pure-form-aligned">
          <div className={styles.controls}>
            <div className="pure-control-group vision_dataset-select">
              <label className={styles.datasetSelectorLabel} htmlFor="dataset-select">Dataset</label>
              <Select
                id="dataset-select"
                className={styles.datasetSelector}
                value={this.state.dataset || client.config().dataset}
                values={datasets}
                onChange={this.handleChangeDataset}
              />

              <Button
                onClick={this.handleListenExecution}
                className={styles.executeQueryButton || 'vision_execute-query-button'}
                loading={listenInProgress}
                kind="default">
                Listen
              </Button>

              <Button
                onClick={this.handleQueryExecution}
                className={styles.executeQueryButton || 'vision_execute-query-button'}
                loading={queryInProgress}
                kind="default">
                Run query
              </Button>
            </div>
          </div>

          <div className={styles.inputLabels || 'inputLabels'}>
            <h3 className={styles.inputLabelQuery || 'query'}>Query</h3>
            <h3 className={styles.inputLabelParams || 'params'}>Params</h3>
          </div>

          <QueryEditor
            className={styles.queryEditor}
            value={this.state.query}
            onExecute={this.handleQueryExecution}
            onChange={this.handleQueryChange}
            onHeightChange={this.handleHeightChange}
            style={{minHeight: this.state.editorHeight}}
          />

          <ParamsEditor
            className={styles.paramsEditor}
            classNameInvalid={styles.paramsEditorInvalid}
            value={this.state.rawParams}
            onExecute={this.handleQueryExecution}
            onChange={this.handleParamsChange}
            onHeightChange={this.handleHeightChange}
            style={{minHeight: this.state.editorHeight}}
          />

          {typeof queryTime === 'number' && (
            <p className={styles.queryTiming || 'queryTiming'}>
              Query time: {queryTime}ms (end-to-end: {e2eTime}ms)
            </p>
          )}
        </form>

        {queryInProgress && <DelayedSpinner />}
        {error && <QueryErrorDialog error={error} />}
        {hasResult && <ResultView data={result} query={query} />}
        {Array.isArray(result) && result.length === 0 && <NoResultsDialog query={query} dataset={dataset} />}
        {listenMutations && listenMutations.length > 0 && <ResultView data={listenMutations} />}
      </div>
    )
  }
}

VisionGui.propTypes = {
  datasets: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string
  }))
}

VisionGui.contextTypes = {
  client: PropTypes.shape({fetch: PropTypes.func}).isRequired,
  styles: PropTypes.object,
  components: PropTypes.object,
}

export default VisionGui
