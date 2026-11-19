// A member-made link button, as visitors see it on the Master Share Page. Also used as the live
// preview in ShareYourApp so the member sees exactly what visitors will.
import { getButtonBackground, getButtonTextColor, isSafeButtonLink } from '../../utils/customShareButtons';

const CustomLinkButton = ({ button, preview = false }) => {
  const className = 'block w-full px-6 py-3.5 rounded-xl font-semibold text-center shadow-md break-words transition-all duration-200';
  const style = { background: getButtonBackground(button), color: getButtonTextColor(button) };
  const label = button.label?.trim() || 'Your button text';

  // Preview (in the editor) and anything with a bad link render as a plain, non-clickable block
  if (preview || !isSafeButtonLink(button.url)) {
    return <div className={className} style={style}>{label}</div>;
  }

  const isWebLink = /^https?:/i.test(button.url);
  return (
    <a
      href={button.url}
      target={isWebLink ? '_blank' : undefined}
      rel={isWebLink ? 'noopener noreferrer' : undefined}
      className={`${className} hover:shadow-lg hover:-translate-y-0.5 hover:brightness-95`}
      style={style}
    >
      {label}
    </a>
  );
};

export default CustomLinkButton;
