import React, {PropTypes} from 'react'
import VisionContainer from './containers/VisionContainer'

// Passes the given Sanity client and components to use down
// through context to child components
class Vision extends React.PureComponent {
  getChildContext() {
    return {
      client: this.props.client,
      styles: this.props.styles,
      components: this.props.components,
    }
  }

  render() {
    return <VisionContainer />
  }
}

Vision.propTypes = {
  client: PropTypes.shape({config: PropTypes.func}).isRequired,
  components: PropTypes.shape({
    Button: PropTypes.func
  }).isRequired,
  styles: PropTypes.shape({
    visionGui: PropTypes.object
  })
}

Vision.defaultProps = {
  styles: {
    visionGui: {}
  }
}

Vision.childContextTypes = {
  client: PropTypes.shape({config: PropTypes.func}).isRequired,
  components: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired
}

module.exports = Vision
