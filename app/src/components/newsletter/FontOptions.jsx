import { FONT_GROUPS } from '../../utils/newsletterFonts';

const FontOptions = () => (
  <>
    {FONT_GROUPS.map((group) => (
      <optgroup key={group.label} label={group.label}>
        {group.fonts.map((font) => (
          <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
            {font.name}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

export default FontOptions;
