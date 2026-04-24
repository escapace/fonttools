import { defineFonttoolsParityTests } from './support/fonttools-parity.contract'
import { createNodeFonttoolsParityAdapter } from './support/fonttools-parity.node'
import { createUvFonttoolsParityAdapter } from './support/fonttools-parity.uv'

defineFonttoolsParityTests('node', createNodeFonttoolsParityAdapter)
defineFonttoolsParityTests('uv', createUvFonttoolsParityAdapter)
