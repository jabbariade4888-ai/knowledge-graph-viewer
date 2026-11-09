import { Component, type ErrorInfo, type ReactNode } from 'react'

interface GraphErrorBoundaryProps {
  children: ReactNode
  onError: () => void
}

interface GraphErrorBoundaryState {
  hasError: boolean
}

export default class GraphErrorBoundary extends Component<GraphErrorBoundaryProps, GraphErrorBoundaryState> {
  state: GraphErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): GraphErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError()
  }

  render() {
    return this.state.hasError ? <div className="graph-fallback" role="status">3D-представление недоступно. Возвращаемся к 2D.</div> : this.props.children
  }
}
