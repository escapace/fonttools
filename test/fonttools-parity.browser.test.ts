import { defineFonttoolsParityTests } from './support/fonttools-parity.contract'
import { createBrowserFonttoolsParityAdapter } from './support/fonttools-parity.browser'

defineFonttoolsParityTests('browser', createBrowserFonttoolsParityAdapter)
