// Newsletter Editor Wrapper
import { useParams } from 'react-router-dom';
import { useMemberAuth } from '../../context/MemberAuthContext';
import NewsletterEditor from './NewsletterEditor';

const NewsletterEditorWrapper = () => {
  const { memberProfile } = useMemberAuth();
  const { newsletterId } = useParams();

  return <NewsletterEditor memberProfile={memberProfile} newsletterId={newsletterId} />;
};

export default NewsletterEditorWrapper;
