import React, {PropTypes} from 'react'
import JsonInspector from 'react-json-inspector'

class ResultList extends React.PureComponent {
  constructor(props) {
    super(props)

    this.state = {expanded: []}
  }

  handleToggleExpandRow(id) {
    const expanded = this.state.expanded
    const currentIndex = expanded.indexOf(id)
    if (currentIndex === -1) {
      expanded.push(id)
    } else {
      expanded.splice(currentIndex, 1)
    }
  }

  getExpandRowHandler(id) {
    return () => this.handleToggleExpandRow(id)
  }

  isExpanded(id) {
    return this.state.expanded.indexOf(id) !== -1
  }

  shouldExpand(path, item) {
    // Expand root-level nodes and refs
    return !isNaN(path) || (item && item._ref)
  }

  render() {
    return (
      <JsonInspector
        className="vision_result-list"
        data={this.props.documents}
        isExpanded={this.shouldExpand}
        search={false}
        filterOptions={{ignoreCase: true}}
      />
    )
  }
}

ResultList.propTypes = {
  documents: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    _type: PropTypes.string.isRequired,
    _updatedAt: PropTypes.string.isRequired,
    _createdAt: PropTypes.string.isRequired
  }))
}

export default ResultList
