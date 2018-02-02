import React, { Component } from 'react'
import PropTypes from 'prop-types'
import thunkMiddleware from 'redux-thunk'
import { createStore, applyMiddleware } from 'redux'
import { connect } from 'react-redux'

import ReducerBuilder from '../redux/ReducerBuilder'
import * as actions from '../redux/actions'
import Utils from '../utils'

/* ---------------------------- Helper Methods ----------------------------- */

/* ----- Recursive Check to see if form is valid  ----- */

const isInvalid = errors => {
  if (Array.isArray(errors)) {
    return errors.some(k => isInvalid(k))
  } else if (errors !== null && typeof errors === 'object') {
    return Object.keys(errors).some(k => isInvalid(errors[k]))
  }
  return errors
}

/* -------------- Generates a new state ------------- */

// TODO figure out way to make state immutable
const newState = state => JSON.parse(JSON.stringify(state))

/* ----------------- Form Component ---------------- */

class Form extends Component {
  static defaultProps = {
    preventDefault: true
  }

  constructor (props) {
    super(props)
    this.fields = []
  }

  getChildContext () {
    return {
      formApi: this.getFormApi(),
      formState: this.getFormState()
    }
  }

  componentWillMount () {
    if (this.props.getApi) {
      this.props.getApi(this.getFormApi())
    }
  }

  componentDidMount () {
    if (this.props.validateOnMount) {
      this.preValidateAll()
      this.validateAll()
      this.asyncValidateAll()
    }
  }

  componentWillReceiveProps (nextProps) {
    const didUpdate = !Utils.isDeepEqual(nextProps.formState, this.props.formState)
    if (this.props.onChange && didUpdate) {
      this.props.onChange(newState(nextProps.formState))
    }
  }

  getFormApi () {
    return {
      submitForm: this.submitForm,
      setValue: this.setValue,
      getValue: this.getValue,
      setTouched: this.setTouched,
      getTouched: this.getTouched,
      getWarning: this.getWarning,
      getError: this.getError,
      getSuccess: this.getSuccess,
      getFormState: this.getFormState,
      setFormState: this.setFormState,
      setError: this.setError,
      setWarning: this.setWarning,
      setSuccess: this.setSuccess,
      resetAll: this.resetAll,
      reset: this.reset,
      clearAll: this.clearAll,
      addValue: this.addValue,
      removeValue: this.removeValue,
      setAllValues: this.setAllValues,
      setAllTouched: this.setAllTouched,
      swapValues: this.swapValues,
      register: this.register,
      deregister: this.deregister,
      asyncValidate: this.asyncValidate,
      validate: this.validate,
      preValidate: this.preValidate
    }
  }

  getFormState () {
    return newState(this.props.formState)
  }

  recurseUpFields = cb => {
    const recurse = async (node, parentName) => {
      const fullName = [parentName, node.field].filter(d => d)
      await Promise.all(node.childFields.map(childNode => recurse(childNode, fullName)))
      return cb(node, parentName)
    }
    return Promise.all(this.fields.map(recurse))
  }

  // Field Api

  setValue = (field, value) => {
    this.props.dispatch(actions.setValue(field, value))
  }

  setTouched = (field, touch = true) => {
    this.props.dispatch(actions.setTouched(field, touch))
  }

  setError = (field, error) => {
    this.props.dispatch(actions.setError(field, error))
  }

  setWarning = (field, warning) => {
    this.props.dispatch(actions.setWarning(field, warning))
  }

  setSuccess = (field, success) => {
    this.props.dispatch(actions.setSuccess(field, success))
  }

  preValidate = (field, validate, opts = {}) => {
    if (!validate || (!opts.submitting && this.props.validateOnSubmit)) {
      return
    }
    this.props.dispatch(actions.preValidate(field, validate))
  }

  validate = (field, validate, opts = {}) => {
    if (!validate || (!opts.submitting && this.props.validateOnSubmit)) {
      return
    }
    this.props.dispatch(actions.validate(field, validate))
  }

  asyncValidate = (field, validate, opts = {}) => {
    if (!validate || (!opts.submitting && this.props.validateOnSubmit)) {
      return
    }
    this.props.dispatch(actions.asyncValidate(field, validate))
  }

  getTouched = field => Utils.get(this.props.formState.touched, field)

  getValue = field => Utils.get(this.props.formState.values, field)

  getError = field => Utils.get(this.props.formState.errors, field)

  getWarning = field => Utils.get(this.props.formState.warnings, field)

  getSuccess = field => Utils.get(this.props.formState.successes, field)

  addValue = (field, value) => {
    this.props.dispatch(
      actions.setValue(field, [...(Utils.get(this.props.formState.values, field) || []), value])
    )
  }

  removeValue = (field, index) => {
    const fieldValue = Utils.get(this.props.formState.values, field) || []
    this.props.dispatch(
      actions.setValue(field, [...fieldValue.slice(0, index), ...fieldValue.slice(index + 1)])
    )
    const fieldTouched = Utils.get(this.props.formState.touched, field) || []
    this.props.dispatch(
      actions.setTouched(field, [...fieldTouched.slice(0, index), ...fieldTouched.slice(index + 1)])
    )
  }

  swapValues = (field, index, destIndex) => {
    const min = Math.min(index, destIndex)
    const max = Math.max(index, destIndex)

    const fieldValues = Utils.get(this.props.formState.values, field) || []

    this.props.dispatch(
      actions.setValue(field, [
        ...fieldValues.slice(0, min),
        fieldValues[max],
        ...fieldValues.slice(min + 1, max),
        fieldValues[min],
        ...fieldValues.slice(max + 1)
      ])
    )
  }

  format = (field, format) => {
    this.props.dispatch(actions.format(field, format))
  }

  reset = field => {
    this.props.dispatch(actions.reset(field))
  }

  // Form API

  setAllTouched = () => {
    this.recurseUpFields((node, fullName) => {
      // Set touched is unique because we dont want to set touched on nested fields
      // We also dont want to call the internal setTouched because that would
      // Execute validation, therefore we need to build the full name in this recursion
      if (node.fieldApi.nestedField) {
        return
      }
      this.setTouched(fullName, true)
    })
  }

  setAllValues = values => this.props.dispatch(actions.setAllValues(values))

  preValidateAll = () => {
    this.recurseUpFields(node => {
      node.fieldApi.preValidate({ submitting: true })
    })
  }

  validateAll = () => {
    this.recurseUpFields(node => {
      node.fieldApi.validate({ submitting: true })
    })
  }

  asyncValidateAll = () =>
    (async () => {
      this.recurseUpFields(node => node.fieldApi.asyncValidate({ submitting: true }))
    })()

  setFormState = formState => {
    this.props.dispatch(actions.setFormState(formState))
  }

  register = (childField, childFieldApi, childFields) => {
    this.fields.push({
      field: childField,
      fieldApi: childFieldApi,
      childFields
    })
  }

  deregister = childField => {
    this.fields = this.fields.filter(d => d.field !== childField)
  }

  resetAll = () => {
    this.props.dispatch(actions.resetAll())
  }

  clearAll = () => {
    this.props.dispatch(actions.clearAll())
  }

  submitForm = async e => {
    this.props.dispatch(actions.submitting(true))
    this.props.dispatch(actions.submits())
    this.setAllTouched()
    this.preValidateAll()
    this.validateAll()

    // We prevent default, by default, unless override is passed
    if (e && e.preventDefault && this.props.preventDefault) {
      e.preventDefault(e)
    }
    // We need to prevent default if override is passed and form is invalid
    if (!this.props.preventDefault) {
      // Pull off errors from form state
      const { errors, asyncErrors } = this.props.formState
      // Check to see if its invalid
      const invalid = isInvalid(errors) || isInvalid(asyncErrors)
      // Prevent default becaues form is invalid
      if (invalid && e && e.preventDefault) {
        e.preventDefault(e)
      }
    }

    // Call asynchronous validators
    try {
      await this.asyncValidateAll()
    } catch (err) {
      // Let the user know we are done submitting
      this.props.dispatch(actions.submitting(false))
      throw err
    }
    // Pull off errors from form state
    const { errors, asyncErrors } = this.props.formState
    // Only submit if we have no errors
    const invalid = isInvalid(errors)
    const asyncInvalid = isInvalid(asyncErrors)
    // Call on validation fail if we are invalid
    if ((invalid || asyncInvalid) && this.props.onSubmitFailure) {
      this.props.onSubmitFailure(errors)
    }
    // Only update submitted if we are not invalid
    // And there are no active asynchronous validations
    if (!(invalid || asyncInvalid) && this.props.formState.asyncValidations === 0) {
      let values = JSON.parse(JSON.stringify(this.props.formState.values))
      // Call pre submit
      if (this.props.preSubmit) {
        values = this.props.preSubmit(values)
      }
      // Update submitted
      this.props.dispatch(actions.submitted())
      // If onSubmit was passed then call it
      if (this.props.onSubmit) {
        try {
          await this.props.onSubmit(values, e)
        } catch (error) {
          this.props.onSubmitFailure({}, error)
        }
      }
    }
    // Let the user know we are done submitting
    this.props.dispatch(actions.submitting(false))
  }

  render () {
    const { children, component, render } = this.props

    const formApi = this.getFormApi()
    const formState = this.getFormState()

    const inlineProps = {
      ...formApi,
      ...formState
    }

    const componentProps = {
      formApi,
      formState
    }

    if (component) {
      return React.createElement(component, componentProps, children)
    }
    if (render) {
      return render(inlineProps)
    }
    if (typeof children === 'function') {
      return children(inlineProps)
    }
    return children
  }
}

Form.childContextTypes = {
  formApi: PropTypes.object,
  formState: PropTypes.object
}

/* ---------- Container ---------- */

const mapStateToProps = state => ({
  formState: state
})

const mapDispatchToProps = dispatch => ({
  dispatch
})

const FormContainer = connect(mapStateToProps, mapDispatchToProps)(Form)

/* ---------- Exports ---------- */
class ReactForm extends Component {
  constructor (props) {
    super(props)

    const { defaultValues } = props

    this.store = createStore(
      ReducerBuilder.build({
        defaultValues
      }),
      applyMiddleware(
        thunkMiddleware // lets us dispatch() functions
        // createLogger() // neat middleware that logs actions
      )
    )
  }

  render () {
    const { children, ...rest } = this.props

    return (
      <FormContainer store={this.store} {...rest}>
        {children}
      </FormContainer>
    )
  }
}

export default ReactForm
